import React, { useState, useEffect } from 'react';

import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';
import ReactTooltip from "react-tooltip";
import Modal from 'react-bootstrap/Modal';
import Accordion from 'react-bootstrap/Accordion';
import Spinner from 'react-bootstrap/Spinner';

import { BsPersonCircle, BsGear, BsQuestionCircle } from "react-icons/bs";

import toast, { Toaster } from 'react-hot-toast';

import Settings from './Settings';

const { resetPassword, config, encrypt, encryption, version, defaults } = window

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [forceChange, setForceChange] = useState(true);
  const [tooltip, showTooltip] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState(false);
  const [settings, setSettings] = useState(defaults)
  const [resetting, setResetting] = useState(false)
  useEffect(() => {
    config.load().then( ( config = {} )=> {
      setSettings({ ...settings, ...config});
    }).catch((err)=>{
      console.error(String(err));
      setError(String(err));
    });

  }, []);
  const handleClick = (val) => {
    setError(false);
    setResetting(true);
    resetPassword(settings, username, forceChange).then( ( entry )=> {
      console.log(entry)
      setResetting(false);
      toast.success('Password reset to ' + entry)
    }).catch((err)=>{
      console.error(String(err));
      setResetting(false);
      setError(String(err));
      toast.error(String(err))
    });
  };
  const factoryReset = () => {
    config.save(defaults).then( ()=> {
      toast.success('Default settings restored and saved.');
      setShowAbout(false);
      setSettings(defaults);
  }).catch((err)=>{ console.error( String(err) ) });
  };
  const AboutModal = () => {
    let copy = structuredClone(settings);
    copy.LDAP_AUTH_PASS = encrypt(copy.LDAP_AUTH_PASS);
    copy = {
      Settings: copy,
      Encryption : encryption,
      PackageVersion: version,
      ReactVersion : React.version,
      OtherVersions : window.versions
    }
    const debug = JSON.stringify(copy, null, 2);
    return (
    <Modal show={showAbout} onHide={()=>{ setShowAbout(false); }} >
      <Modal.Body className="justify-content-md-center text-center">
        <h4>ldap-resetr {version}</h4>
        <p><a href="https://github.com/mattkrins/ldap-resetr" >https://github.com/mattkrins/ldap-resetr</a></p>
        <p>
            Node: {window.versions.node}<br/>
            Electron: {window.versions.electron}<br/>
            React: {React.version}
        </p>
        <Accordion className="mb-3">
          <Accordion.Item eventKey="0">
            <Accordion.Header>Debug Info</Accordion.Header>
            <Accordion.Body  className="text-start">
              <pre>{debug}</pre>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
        <Button variant="primary" onClick={factoryReset}>Factory Reset</Button>
      </Modal.Body>
    </Modal>
  )};
 
  const handleCheck = (val) => setForceChange(val);
  return (
    <>
    <Toaster/>
    <BsGear size={"2em"} color={"grey"} onClick={()=>{ setShowSettings(true); }} className="pointer position-absolute top-0 start-0 m-2" />
    <BsQuestionCircle size={"2em"} color={"grey"} onClick={()=>{ setShowAbout(true); }} className="pointer position-absolute top-0 end-0 m-2" />
    <Container>
      <InputGroup className="justify-content-md-center text-center">
        <h3 style={{minWidth:"256px"}}>Reset Password <BsPersonCircle/></h3>
      </InputGroup>
      <InputGroup className="justify-content-md-center">
        <FloatingLabel controlId="Username" label="Username">
            <Form.Control isInvalid={error} value={username} onInput={e => {setUsername(e.target.value)}} type="text" placeholder="Username" className="rounded-0 rounded-start" />
        </FloatingLabel>
        <InputGroup.Checkbox data-tip data-for="registerTip" checked={forceChange} onChange={e => {handleCheck(e.target.checked)}}  onMouseLeave={() => { showTooltip(false); setTimeout(() => showTooltip(true), 50); }} />
        {tooltip && <ReactTooltip id="registerTip" place="top" effect="solid" globalEventOff="click">
          User must change password at next login
        </ReactTooltip> }
        <Button disabled={resetting} variant="outline-primary" onClick={handleClick}>{resetting ? <Spinner animation="border" size="sm"/> : 'Reset'}</Button>
      </InputGroup>
      <InputGroup className="justify-content-md-center text-center">
        {error && <div className="fw-light text-danger" style={{minWidth:"256px"}}>{error}</div>}
      </InputGroup>
    </Container>
    <Settings show={showSettings} setShow={setShowSettings} settings={settings} setSettings={setSettings} toast={toast}  />
    <AboutModal/>
    </>
  );
}

export default App;
