use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
#[cfg(all(target_arch = "arm", target_os = "linux"))]
use rppal::gpio::Error as RpError;
use serde_json::json;

pub(crate) enum Error {
    BadRequest(String),
    #[cfg(all(target_arch = "arm", target_os = "linux"))]
    RpError(RpError),
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
impl From<RpError> for Error {
    fn from(e: RpError) -> Self {
        Error::RpError(e)
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            Error::BadRequest(e) => (StatusCode::BAD_REQUEST, e),
            #[cfg(all(target_arch = "arm", target_os = "linux"))]
            Error::RpError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };

        let body = Json(json!({
            "detail": error_message,
        }));

        (status, body).into_response()
    }
}
