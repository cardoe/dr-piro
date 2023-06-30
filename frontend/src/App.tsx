import React, { useEffect, useRef, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import './App.css';
import { disablePin, enablePin, getPinConfig, firePin, setDuration, PinConfig } from './api';

interface ConfigModalProps {
  config: PinConfig;
  showConfig: boolean;
  setShowConfig: (show: boolean) => void;
  fetchPinConfig: () => void;
}

function ConfigModal({ config, showConfig, setShowConfig, fetchPinConfig}: ConfigModalProps) {
  const duration = useRef<HTMLInputElement>(null);
  const pin = useRef<HTMLInputElement>(null);

  const disablePinClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const btn = event.currentTarget;
    disablePin(Number(btn.value));
    fetchPinConfig();
  }

  const handleClose = async () => {
    setShowConfig(false);
    await fetchPinConfig();
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const btn = event.currentTarget;

    if (btn.value === "Duration" && duration?.current?.value !== undefined) {
      const val = Number(duration.current.value);
      setDuration(val);
      fetchPinConfig();
    } else if (btn.value === "Enable" && pin?.current?.value !== undefined) {
      const val = Number(pin.current.value);
      enablePin(val);
      fetchPinConfig();
    }
  };

  return (
    <>
      <Modal show={showConfig} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Configs</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form>
            <Row className="mb-3 align-items-center">
              <InputGroup as={Col}>
                <InputGroup.Text>Duration</InputGroup.Text>
                <Form.Control type="number" ref={duration} name="duration" placeholder={String(config.duration)} />
              </InputGroup>
              <Col>
                <Button type="button" onClick={handleClick} value="Duration">Save</Button>
              </Col>
            </Row>
            <Row className="mb-3 align-items-center">
              <InputGroup as={Col}>
                <InputGroup.Text>Pin</InputGroup.Text>
                <Form.Control type="number" ref={pin} name="pin" />
              </InputGroup>
              <Col>
                <Button type="button" onClick={handleClick} value="Enable">Enable</Button>
              </Col>
            </Row>
            {
              config.pins.map((pin, label) =>
                <Row key={label} className="mb-3">
                  <Button type="button" onClick={disablePinClick} value={pin}>Disable Launch {label} / Pin {pin}</Button>
                </Row>
              )
            }
            </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

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
  }, [duration, clear]);

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
      {error !== '' ? <Alert variant='warning'>Failed to launch: {error}</Alert> : null}
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

interface HeaderProps {
  showConfig: boolean;
  setShowConfig: React.Dispatch<React.SetStateAction<boolean>>;
}

function Header({ showConfig, setShowConfig }: HeaderProps) {
  const toggleConfig = async (event: React.MouseEvent<HTMLButtonElement>) => setShowConfig(!showConfig);

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
          <Nav className="justify-content-end">
            <Nav.Link onClick={toggleConfig}>Gear</Nav.Link>
          </Nav>
      </Container>
    </Navbar>
  )
}

function App() {
  const [pinConfig, setPinConfig] = useState({ pins: new Array(), duration: 0});
  const [showConfig, setShowConfig] = useState(false);
  const fetchPinConfig = async () => {
    try {
      const newPinConfig = await getPinConfig();
      setPinConfig(newPinConfig);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchPinConfig();
  }, []);

  return (
    <div className="App">
      <Header showConfig={showConfig} setShowConfig={setShowConfig} />
      <ConfigModal config={pinConfig} showConfig={showConfig} setShowConfig={setShowConfig} fetchPinConfig={fetchPinConfig} />
      <main className="my-5 py-3">
        <LauncherList pins={pinConfig.pins} duration={pinConfig.duration} />
      </main>
    </div>
  );
}

export default App;
