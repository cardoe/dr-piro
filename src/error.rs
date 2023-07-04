use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
#[cfg(all(target_arch = "arm", target_os = "linux"))]
use rppal::gpio::Error as RpError;
use serde_json::json;
use std::fmt;

#[derive(Debug)]
pub(crate) enum Error {
    Conflict,
    BadRequest(String),
    NotFound(String),
    Io(::tokio::io::Error),
    Json(::serde_json::Error),
    #[cfg(all(target_arch = "arm", target_os = "linux"))]
    RpError(RpError),
}

#[cfg(all(target_arch = "arm", target_os = "linux"))]
impl From<RpError> for Error {
    fn from(e: RpError) -> Self {
        Error::RpError(e)
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use ::std::error::Error as StdError;
        if let Some(e) = self.source() {
            write!(f, "{}: ", e)?;
        }
        writeln!(
            f,
            "{}",
            match self {
                Error::Conflict => "unable to access pin list".into(),
                Error::BadRequest(e) => e.to_owned(),
                Error::NotFound(e) => e.to_owned(),
                Error::Io(_) => "file issue".into(),
                Error::Json(_) => "JSON parse".into(),
                #[cfg(all(target_arch = "arm", target_os = "linux"))]
                Error::RpError(_) => "Raspberry Pi".into(),
            }
        )
    }
}

impl ::std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Conflict => None,
            Error::BadRequest(_) => None,
            Error::NotFound(_) => None,
            Error::Io(e) => Some(e),
            Error::Json(e) => Some(e),
            #[cfg(all(target_arch = "arm", target_os = "linux"))]
            Error::RpError(e) => Some(e),
        }
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            Error::Conflict => (StatusCode::CONFLICT, self.to_string()),
            Error::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            Error::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            Error::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            Error::Json(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            #[cfg(all(target_arch = "arm", target_os = "linux"))]
            Error::RpError(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        let body = Json(json!({
            "detail": error_message,
        }));

        (status, body).into_response()
    }
}
