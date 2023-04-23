use axum::{extract::Path, http::StatusCode, routing::get, Router};
#[cfg(all(target_arch = "arm", target_os = "linux"))]
use rppal::gpio::Gpio;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::debug;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[cfg(all(target_arch = "arm", target_os = "linux"))]
mod error;

async fn api_root() -> &'static str {
    "Hello API World"
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
async fn fire_pin(Path(pin_id): Path<u8>) -> Result<StatusCode, error::Error> {
    let gpio = Gpio::new()?;
    let mut pin = gpio.get(pin_id)?.into_output();

    debug!(pin_id = pin_id, "Toggling pin");

    pin.set_high();
    tokio::time::sleep(Duration::from_secs(1)).await;
    pin.set_low();
    Ok(StatusCode::ACCEPTED)
}

#[cfg(not(all(target_arch = "arm", target_os = "linux")))]
async fn fire_pin(Path(pin_id): Path<u8>) -> StatusCode {
    debug!(pin_id = pin_id, "Toggling pin (pretend)");
    tokio::time::sleep(Duration::from_secs(1)).await;
    StatusCode::ACCEPTED
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

#[tokio::main]
async fn main() {
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
        // `GET /api/fire/:pin goes to `fire_pin`
        .route("/api/fire/:pin", get(fire_pin))
        .fallback_service(serve_dir);

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::debug!("listening on http://{}", addr);
    axum::Server::bind(&addr)
        .serve(app.layer(TraceLayer::new_for_http()).into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}
