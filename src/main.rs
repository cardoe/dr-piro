use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, patch, put},
    Router,
};
use clap::{value_parser, Parser};
#[cfg(all(target_arch = "arm", target_os = "linux"))]
use rppal::gpio::Gpio;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU8, Ordering},
    Arc, Mutex,
};
use std::time::Duration;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::debug;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod error;

struct AppState {
    pin_list: Mutex<Vec<u8>>,
    duration: AtomicU8,
    config: PathBuf,
}

#[derive(Deserialize, Serialize, Debug)]
struct PinConfig {
    pins: Vec<u8>,
    duration: u8,
}

#[derive(Deserialize, Debug)]
struct PinConfigPatch {
    duration: Option<u8>,
}

async fn api_root() -> &'static str {
    "Hello API World"
}

async fn fire_list(State(state): State<Arc<AppState>>) -> Json<PinConfig> {
    match state.pin_list.lock() {
        Ok(x) => Json(PinConfig {
            pins: x.clone(),
            duration: state.duration.load(Ordering::SeqCst),
        }),
        Err(_) => Json(PinConfig {
            pins: vec![],
            duration: 0,
        }),
    }
}

async fn fire_config(
    State(state): State<Arc<AppState>>,
    Json(config): Json<PinConfigPatch>,
) -> Result<Json<PinConfig>, error::Error> {
    match state.pin_list.lock() {
        Ok(x) => {
            if let Some(dur) = config.duration {
                state.duration.store(dur, Ordering::SeqCst);
                debug!(duration = dur, "Storing new duration");
            }
            let new_state = PinConfig {
                pins: x.clone(),
                duration: state.duration.load(Ordering::SeqCst),
            };

            /*
                        async {
                            let mut file = File::create(&state.config)
                                .await
                                .map_err(|e| error::Error::Io(e.to_string()))?;
                            let buf =
                                serde_json::to_vec_pretty(&new_state).map_err(|e| error::Error::Json(e.to_string()))?;
                            file.write_all(&buf)
                                .await
                                .map_err(|e| error::Error::Io(e.to_string()))?;

                            Ok::<(), error::Error>(())
                        }
                        .await?;
            */

            Ok(Json(new_state))
        }
        Err(_) => Err(error::Error::Conflict),
    }
}

async fn enable_pin(Path(pin_id): Path<u8>, State(state): State<Arc<AppState>>) -> StatusCode {
    match state.pin_list.lock() {
        Ok(mut x) => {
            x.push(pin_id);
            StatusCode::ACCEPTED
        }
        Err(_) => StatusCode::CONFLICT,
    }
}

async fn disable_pin(Path(pin_id): Path<u8>, State(state): State<Arc<AppState>>) -> StatusCode {
    match state.pin_list.lock() {
        Ok(mut x) => match x.binary_search(&pin_id) {
            Ok(idx) => {
                x.remove(idx);
                StatusCode::ACCEPTED
            }
            Err(_) => StatusCode::NOT_FOUND,
        },
        Err(_) => StatusCode::CONFLICT,
    }
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
async fn fire_pin(
    Path(pin_id): Path<u8>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, error::Error> {
    match state.pin_list.lock() {
        Ok(x) => {
            if !x.contains(&pin_id) {
                return Err(error::Error::BadRequest(format!("invalid pin {}", pin_id,)));
            }
        }
        Err(_) => {
            return Err(error::Error::Conflict);
        }
    }

    let gpio = Gpio::new()?;
    let mut pin = gpio.get(pin_id)?.into_output();

    debug!(pin_id = pin_id, "Toggling pin");

    pin.set_high();
    tokio::time::sleep(Duration::from_secs(
        state.duration.load(Ordering::SeqCst) as u64
    ))
    .await;
    pin.set_low();
    Ok(StatusCode::ACCEPTED)
}

#[cfg(not(all(target_arch = "arm", target_os = "linux")))]
async fn fire_pin(
    Path(pin_id): Path<u8>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, error::Error> {
    match state.pin_list.lock() {
        Ok(x) => {
            if !x.contains(&pin_id) {
                return Err(error::Error::BadRequest(format!("invalid pin {}", pin_id,)));
            }
        }
        Err(_) => {
            return Err(error::Error::Conflict);
        }
    }
    debug!(pin_id = pin_id, "Toggling pin (pretend)");
    tokio::time::sleep(Duration::from_secs(
        state.duration.load(Ordering::SeqCst) as u64
    ))
    .await;
    Ok(StatusCode::ACCEPTED)
}

/// Tokio signal handler that will wait for a user to press CTRL+C or term signal
/// We use this in our hyper `Server` method `with_graceful_shutdown`.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    println!("signal received, starting graceful shutdown");
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Address and Port to listen on
    #[arg(short, long, default_value = "0.0.0.0:8000", value_parser = value_parser!(SocketAddr))]
    listen: SocketAddr,

    /// Location of config data
    #[arg(long)]
    config: Option<PathBuf>,

    /// Start Pin
    #[arg(long)]
    start: Option<u8>,

    /// End Pin
    #[arg(long)]
    end: Option<u8>,

    /// How long to hold the pin when firing
    #[arg(long)]
    duration: Option<u8>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn ::std::error::Error>> {
    let args = Args::parse();

    // load existing state from our config file
    let cfg_path = if let Some(cfg) = args.config {
        cfg
    } else {
        dirs::config_dir()
            .ok_or_else(|| "Unable to determine users config dir".to_string())?
            .join(env!("CARGO_PKG_NAME"))
            .join(env!("CARGO_BIN_NAME"))
    };
    let mut cfg_file = File::open(&cfg_path).await?;
    let mut cfg_contents = vec![];
    cfg_file.read_to_end(&mut cfg_contents).await?;
    let mut state: PinConfig = serde_json::from_slice(&cfg_contents)?;

    // let the command line over ride the config
    if let Some(start) = args.start {
        if let Some(end) = args.end {
            state.pins = (start..end).collect();
        }
    }

    if let Some(duration) = args.duration {
        state.duration = duration;
    }

    let shared_state = Arc::new(AppState {
        pin_list: Mutex::new(state.pins),
        duration: AtomicU8::new(state.duration),
        config: cfg_path,
    });

    // initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "dr_piro=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // serve the UI bits
    let serve_dir = ServeDir::new("frontend/build")
        .not_found_service(ServeFile::new("frontend/build/index.html"));

    // build our application with a route
    let app = Router::new()
        // `GET /api/` goes to `api_root`
        .route("/api/", get(api_root))
        // `GET /api/fire/` goes to `fire_list`
        .route("/api/fire/", get(fire_list))
        // `PATCH /api/fire/` goes to `fire_config`
        .route("/api/fire/", patch(fire_config))
        // `GET /api/fire/:pin` goes to `fire_pin`
        .route("/api/fire/:pin", get(fire_pin))
        // `PUT /api/fire/:pin` enables the pin
        .route("/api/fire/:pin", put(enable_pin))
        // `DELETE /api/fire/:pin` disables the pin
        .route("/api/fire/:pin", delete(disable_pin))
        .with_state(shared_state)
        .fallback_service(serve_dir);

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    tracing::debug!("listening on http://{}", args.listen);
    axum::Server::bind(&args.listen)
        .serve(app.layer(TraceLayer::new_for_http()).into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();

    Ok(())
}
