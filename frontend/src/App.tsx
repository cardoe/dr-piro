import React, { useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Navbar from 'react-bootstrap/Navbar';
import Alert from 'react-bootstrap/Alert';
import './App.css';
import { getPinConfig, firePin, PinConfig } from './api';

interface LaunchAlertProps {
  label: number;
  clear: React.Dispatch<React.SetStateAction<boolean>>;
  duration: number;
}

function LaunchAlert({ label, clear, duration }: LaunchAlertProps) {
  useEffect(() => {
    const timeId = setTimeout(() => {
      clear(false);
    }, duration * 1000);

    return () => {
      clearTimeout(timeId);
    }
  }, []);  

  return (
    <Alert variant='secondary'>Launching {label}</Alert>
  )
}

interface LauncherProps {
  pin: number;
  label: number;
  duration: number;
}

function Launcher({ pin, label, duration }: LauncherProps) {
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const button: HTMLButtonElement = event.currentTarget;
    setClicked(true);
    try {
      await firePin(pin);
    } catch (err) {
      setError(err as string);
    }
  }

  return (
    <>
      <Col>Launcher {label}</Col>
      <Col><Button variant="danger" className="mr-2" value={pin} onClick={handleClick}>Fire</Button></Col>
      {clicked ? <LaunchAlert label={label} clear={setClicked} duration={duration} /> : null}
      {error !== '' ? <Alert variant='warning'>Failed to launch</Alert> : null}
    </>
  );
}

function LauncherList({ pins, duration }: PinConfig) {
  return (
    <Container fluid="sm" className="container-md">
    {
      pins.map((pin, label) =>
        <Row key={label} className="justify-content-md-center mb-2">
          <Launcher pin={pin} label={label + 1} duration={duration} />
          </Row>
      )
    }
    </Container>
  );
}

function Header() {
  return (
    <Navbar fixed="top" bg="dark" variant="dark" expand="sm">
      <Container>
        <Navbar.Brand href="#home">
          <img
              alt=""
              src="/logo192.png"
              width="30"
              height="30"
              className="d-inline-block align-top"
            />{' '}
            DR Piro
          </Navbar.Brand>
      </Container>
    </Navbar>
  )
}

function App() {
  const [pinConfig, setPinConfig] = useState({ pins: new Array(), duration: 0});
  useEffect(() => {
    const fetchPinConfig = async () => {
      try {
        const newPinConfig = await getPinConfig();
        setPinConfig(newPinConfig);
      } catch (err) {
        console.log(err);
      }
    };

    fetchPinConfig();
  }, []);

  return (
    <div className="App">
      <Header />
      <main className="my-5 py-3">
        <LauncherList pins={pinConfig.pins} duration={pinConfig.duration} />
      </main>
    </div>
  );
}

export default App;
