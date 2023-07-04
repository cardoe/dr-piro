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
  disabled: boolean;
}

function Launcher({ pin, label, duration, disabled }: LauncherProps) {
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState('');
  const [dis, setDis] = useState(disabled);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    setClicked(true);
    try {
      await firePin(pin);
      setDis(true);
    } catch (err) {
      setError(err as string);
    }
  }

  return (
    <>
      <Col>Launcher {label}</Col>
      <Col><Button variant={dis ? "secondary" : "danger"} disabled={dis} className="mr-2" value={pin} onClick={handleClick}>Fire</Button></Col>
      {clicked ? <LaunchAlert label={label} clear={setClicked} duration={duration} /> : null}
      {error !== '' ? <Alert variant='warning'>Failed to launch: {error}</Alert> : null}
    </>
  );
}

function LauncherList({ pins, triggered, duration }: PinConfig) {
  return (
    <Container fluid="sm" className="container-md">
    {
      pins.map((pin, label) =>
        <Row key={label} className="justify-content-md-center mb-2">
          <Launcher pin={pin} label={label + 1} duration={duration} disabled={triggered.includes(pin)} />
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
    <Navbar fixed="top" expand="sm" bg="primary">
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
            <Nav.Link onClick={toggleConfig}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-gear" viewBox="0 0 16 16">
  <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
  <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
</svg></Nav.Link>
          </Nav>
      </Container>
    </Navbar>
  )
}

function App() {
  const [pinConfig, setPinConfig] = useState({ pins: new Array(), triggered: new Array(), duration: 0});
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
        <LauncherList pins={pinConfig.pins} triggered={pinConfig.triggered} duration={pinConfig.duration} />
      </main>
    </div>
  );
}

export default App;
