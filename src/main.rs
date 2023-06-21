use axum::{extract::Path, http::StatusCode, response::Json, routing::get, Router};
use clap::{value_parser, Parser};
#[cfg(all(target_arch = "arm", target_os = "linux"))]
use rppal::gpio::Gpio;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::debug;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod error;

async fn api_root() -> &'static str {
    "Hello API World"
}

async fn fire_list(_body: String, start: u8, end: u8) -> Json<Value> {
    Json(json!({ "start": start, "end": end }))
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
async fn fire_pin(Path(pin_id): Path<u8>, start: u8, end: u8) -> Result<StatusCode, error::Error> {
    if pin_id < start || pin_id > end {
        return Err(error::Error::BadRequest(format!(
            "invalid pin {}, valid range {} - {}",
            pin_id, start, end
        )));
    }
    let gpio = Gpio::new()?;
    let mut pin = gpio.get(pin_id)?.into_output();

    debug!(pin_id = pin_id, "Toggling pin");

    pin.set_high();
    tokio::time::sleep(Duration::from_secs(1)).await;
    pin.set_low();
    Ok(StatusCode::ACCEPTED)
}

#[cfg(not(all(target_arch = "arm", target_os = "linux")))]
async fn fire_pin(Path(pin_id): Path<u8>, start: u8, end: u8) -> Result<StatusCode, error::Error> {
    if pin_id < start || pin_id > end {
        return Err(error::Error::BadRequest(format!(
            "invalid pin {}, valid range {} - {}",
            pin_id, start, end
        )));
    }
    debug!(pin_id = pin_id, "Toggling pin (pretend)");
    tokio::time::sleep(Duration::from_secs(1)).await;
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

    /// Start Pin
    #[arg(short, long, default_value_t = 1)]
    start: u8,

    /// End Pin
    #[arg(short, long, default_value_t = 16)]
    end: u8,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

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
        // `GET /api/fire/ goes to `fire_list`
        .route(
            "/api/fire/",
            get(move |body| fire_list(body, args.start, args.end)),
        )
        // `GET /api/fire/:pin goes to `fire_pin`
        .route(
            "/api/fire/:pin",
            get(move |path| fire_pin(path, args.start, args.end)),
        )
        .fallback_service(serve_dir);

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    tracing::debug!("listening on http://{}", args.listen);
    axum::Server::bind(&args.listen)
        .serve(app.layer(TraceLayer::new_for_http()).into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}
