use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use clap::{value_parser, Parser};
#[cfg(all(target_arch = "arm", target_os = "linux"))]
use rppal::gpio::Gpio;
use serde::{Deserialize, Serialize};
use std::path::{self, PathBuf};
use std::sync::{
    atomic::{AtomicU8, Ordering},
    Arc, Mutex,
};
use std::time::Duration;
use std::{io::ErrorKind, net::SocketAddr};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::{debug, info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod error;

struct AppState {
    pin_list: Mutex<Vec<u8>>,
    triggered: Mutex<Vec<u8>>,
    duration: AtomicU8,
    config: PathBuf,
}

impl AppState {
    fn check_pin(&self, pin_id: u8) -> Result<(), error::Error> {
        debug!(pin_id = pin_id, "Checking if pin is configured");
        match self.pin_list.lock() {
            Ok(x) => {
                if x.contains(&pin_id) {
                    Ok(())
                } else {
                    Err(error::Error::BadRequest(format!("invalid pin {}", pin_id,)))
                }
            }
            Err(_) => {
                warn!(pin_id = pin_id, "unable to get pin mutex");
                Err(error::Error::Conflict)
            }
        }
    }
    fn trigger_pin(&self, pin_id: u8) -> Result<(), error::Error> {
        match self.triggered.lock() {
            Ok(mut x) => {
                if x.contains(&pin_id) {
                    debug!(pin_id = pin_id, "pin is already triggered");
                    Err(error::Error::BadRequest(format!(
                        "pin {} is already triggered",
                        pin_id
                    )))
                } else {
                    debug!(pin_id = pin_id, "triggered pin");
                    x.push(pin_id);
                    Ok(())
                }
            }
            Err(_) => {
                warn!(pin_id = pin_id, "unable to get pin mutex");
                Err(error::Error::Conflict)
            }
        }
    }

    fn to_pin_config(&self) -> Result<PinConfig, error::Error> {
        let pins = if let Ok(pins) = self.pin_list.lock() {
            Ok(pins.clone())
        } else {
            Err(error::Error::Conflict)
        }?;

        let triggered = if let Ok(triggered) = self.triggered.lock() {
            Ok(triggered.clone())
        } else {
            Err(error::Error::Conflict)
        }?;

        Ok(PinConfig {
            pins,
            triggered,
            duration: self.duration.load(Ordering::SeqCst),
        })
    }
}

#[derive(Default, Deserialize, Serialize, Debug)]
struct PinConfig {
    pins: Vec<u8>,
    triggered: Vec<u8>,
    duration: u8,
}

impl PinConfig {
    async fn load<P: AsRef<path::Path>>(path: P) -> Result<PinConfig, error::Error> {
        if let Some(parent) = path.as_ref().parent() {
            ::tokio::fs::create_dir_all(parent)
                .await
                .map_err(error::Error::Io)?;
        }
        info!("Loading config file");
        match File::open(&path).await {
            Ok(mut cfg_file) => {
                let mut cfg_contents = vec![];
                cfg_file
                    .read_to_end(&mut cfg_contents)
                    .await
                    .map_err(error::Error::Io)?;
                serde_json::from_slice(&cfg_contents).map_err(error::Error::Json)
            }
            Err(e) => match e.kind() {
                ErrorKind::NotFound => Ok(PinConfig::default()),
                _ => Err(error::Error::Io(e)),
            },
        }
    }

    async fn save<P: AsRef<path::Path>>(&self, path: P) -> Result<(), error::Error> {
        // convert the config to a JSON byte stream
        let buf = serde_json::to_vec_pretty(self).map_err(error::Error::Json)?;

        info!("Saving config");

        // save the JSON byte stream to our config file
        async {
            let mut file = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(&path)
                .await?;

            file.write_all(&buf).await
        }
        .await
        .map_err(error::Error::Io)
    }
}

#[derive(Deserialize, Debug)]
struct PinConfigPatch {
    duration: Option<u8>,
}

async fn api_root() -> &'static str {
    "Hello API World"
}

async fn fire_list(State(state): State<Arc<AppState>>) -> Result<Json<PinConfig>, error::Error> {
    state.to_pin_config().map(Json)
}

async fn fire_config(
    State(state): State<Arc<AppState>>,
    Json(config): Json<PinConfigPatch>,
) -> Result<Json<PinConfig>, error::Error> {
    if let Some(dur) = config.duration {
        state.duration.store(dur, Ordering::SeqCst);
        debug!(duration = dur, "Storing new duration");
    }

    // get our new state to return
    let new_state = state.to_pin_config()?;
    // save the changes
    new_state.save(&state.config).await?;

    Ok(Json(new_state))
}

async fn enable_pin(
    Path(pin_id): Path<u8>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<PinConfig>, error::Error> {
    match state.pin_list.lock() {
        Ok(mut x) => {
            if x.contains(&pin_id) {
                debug!(pin_id = pin_id, "pin already enabled");
                Err(error::Error::BadRequest(format!(
                    "pin {} is already enabled",
                    pin_id
                )))
            } else {
                is_valid_pin(pin_id)?;
                x.push(pin_id);
                Ok(())
            }
        }
        Err(_) => {
            warn!(pin_id = pin_id, "unable to get pin mutex");
            Err(error::Error::Conflict)
        }
    }?;

    let new_cfg = state.to_pin_config()?;
    new_cfg.save(&state.config).await?;
    Ok(Json(new_cfg))
}

async fn disable_pin(
    Path(pin_id): Path<u8>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<PinConfig>, error::Error> {
    match state.pin_list.lock() {
        Ok(mut x) => match x.binary_search(&pin_id) {
            Ok(idx) => {
                x.remove(idx);
                Ok(())
            }
            Err(_) => Err(error::Error::NotFound(format!(
                "pin {} is not enabled",
                pin_id
            ))),
        },
        Err(_) => Err(error::Error::Conflict),
    }?;

    let new_cfg = state.to_pin_config()?;
    new_cfg.save(&state.config).await?;
    Ok(Json(new_cfg))
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
fn is_valid_pin(pin_id: u8) -> Result<(), error::Error> {
    debug!(pin_id = pin_id, "Checking if pin is GPIO");
    let gpio = Gpio::new()?;
    gpio.get(pin_id).map(|_| ()).map_err(|e| e.into())
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
async fn fire_pin(
    Path(pin_id): Path<u8>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, error::Error> {
    state.check_pin(pin_id)?;
    let gpio = Gpio::new()?;
    let mut pin = gpio.get(pin_id)?.into_output();

    debug!(pin_id = pin_id, "Toggling pin");

    state.trigger_pin(pin_id)?;
    pin.set_high();
    tokio::time::sleep(Duration::from_secs(
        state.duration.load(Ordering::SeqCst) as u64
    ))
    .await;
    pin.set_low();
    Ok(StatusCode::ACCEPTED)
}

#[cfg(not(all(target_arch = "arm", target_os = "linux")))]
fn is_valid_pin(pin_id: u8) -> Result<(), error::Error> {
    debug!(pin_id = pin_id, "Checking if pin is GPIO");
    Ok(())
}

#[cfg(not(all(target_arch = "arm", target_os = "linux")))]
async fn fire_pin(
    Path(pin_id): Path<u8>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, error::Error> {
    state.check_pin(pin_id)?;
    debug!(pin_id = pin_id, "Toggling pin (pretend)");
    state.trigger_pin(pin_id)?;
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

    // load our config
    let mut state = PinConfig::load(&cfg_path).await?;

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
        triggered: Mutex::new(vec![]),
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
        // `PATCH /api/fire/` goes to `fire_config`
        .route("/api/fire/", get(fire_list).patch(fire_config))
        // `GET /api/fire/:pin` goes to `fire_pin`
        // `PUT /api/fire/:pin` enables the pin
        // `DELETE /api/fire/:pin` disables the pin
        .route(
            "/api/fire/:pin",
            get(fire_pin).put(enable_pin).delete(disable_pin),
        )
        .with_state(shared_state)
        .fallback_service(serve_dir);

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    tracing::debug!("listening on http://{}", args.listen);
    let listener = tokio::net::TcpListener::bind(&args.listen).await?;
    axum::serve(
        listener,
        app.layer(TraceLayer::new_for_http()).into_make_service(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}
