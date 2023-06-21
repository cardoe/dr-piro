import React, { useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Navbar from 'react-bootstrap/Navbar';
import Alert from 'react-bootstrap/Alert';
import './App.css';
import { getPinRange, firePin, PinRange } from './api';

interface LaunchAlertProps {
  pos: number;
  clear: React.Dispatch<React.SetStateAction<boolean>>;
}

function LaunchAlert({ pos, clear }: LaunchAlertProps) {
  useEffect(() => {
    const timeId = setTimeout(() => {
      clear(false);
    }, 3000);

    return () => {
      clearTimeout(timeId);
    }
  }, []);  

  return (
    <Alert variant='secondary'>Launching {pos}</Alert>
  )
}

interface LauncherProps {
  pos: number;
}

function Launcher({ pos }: LauncherProps) {
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const button: HTMLButtonElement = event.currentTarget;
    setClicked(true);
    try {
      await firePin(pos);
    } catch (err) {
      setError(err as string);
    }
  }

  return (
    <>
      <Col>Launcher {pos}</Col>
      <Col><Button variant="danger" className="mr-2" value={pos} onClick={handleClick}>Fire</Button></Col>
      {clicked ? <LaunchAlert pos={pos} clear={setClicked}/> : null}
      {error !== '' ? <Alert variant='warning'>Failed to launch</Alert> : null}
    </>
  );
}

function LauncherList({ start, end }: PinRange) {
  return (
    <Container fluid="sm" className="container-md">
    {
      Array.from(Array(end + 1 - start), (e, i) => {
        return (
          <Row key={i} className="justify-content-md-center mb-2">
            <Launcher pos={i + start} />
          </Row>
        );
      })
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
  const [pinRange, setPinRange] = useState({ start: 0, end: 0});
  useEffect(() => {
    const fetchPinRange = async () => {
      try {
        const newPinRange = await getPinRange();
        setPinRange(newPinRange);
      } catch (err) {
        console.log(err);
      }
    };

    fetchPinRange();
  }, []);

  return (
    <div className="App">
      <Header />
      <main className="my-5 py-3">
        <LauncherList start={pinRange.start} end={pinRange.end} />
      </main>
    </div>
  );
}

export default App;
