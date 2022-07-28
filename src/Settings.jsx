import React, { useState, useEffect } from 'react'
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import ListGroup from 'react-bootstrap/ListGroup';

const { LDAP, printer, config } = window

export default function Settings({show, setShow, settings, setSettings, toast}) {
    const [feedback, setFeedback] = useState({ errors : {}, response : {} })
    const [printers, setPrinters] = useState([])
    const [gotPrinters, gotPrintersS] = useState(false)

    useEffect(() => {
        if (!show || gotPrinters) return
        const loading = toast.loading('Finding Printers');
        setLoading("PRINTERS", true);
        printer.getPrinters().then( ( printerList )=> {
            console.log('Printer List:',printerList)
            setPrinters([
                { Name: "Disabled", shareName: "Disabled" },
                ...printerList
            ]);
            gotPrintersS(true);
            setLoading("PRINTERS", false);
            toast.success('Found printers 🖨️', { id: loading });
        }).catch((err)=>{
            console.error( String(err) );
            toast.error(String(err), { id: loading });
            setLoading("PRINTERS", false);
        });
    }, [show]);

    const clearFeedback = () => {
        setFeedback({ errors : {}, response : {} })
    }
    const addFeedback = (errors = false, response = false) => {
        setFeedback({ errors : errors || {}, response : response || {} })
    }
    const handleClose = () => {setShow(false); clearFeedback({}); };
    const [waitingFor, setLoaders] = useState({
        LDAP_URI : false,
        LDAP_AUTH : false,
        PRINTERS : false
    })
    const setLoading = (key, value = true) => {
        const clone = structuredClone(waitingFor);
        clone[key] = value;
        setLoaders(clone);
    }
    const testInput = (id = false) => {
        if (!id) return id
        setLoading(id, true);
        clearFeedback()
        return id
    }
    const error = (errors = [], id = false) => {
        setLoading(id, false)
        const t = {}
        t[id] = errors;
        addFeedback(t)
    }
    const success = (response = [], id = false) => {
        setLoading(id, false)
        if (!response) return;
        const t = {}
        t[id] = response;
        addFeedback(false, t)
    }
    const updateValue = (key, value = '') => {
        const clone = structuredClone(settings);
        clone[key] = value;
        setSettings(clone);
    }
    const ldapURI = () => {
        const id = testInput("LDAP_URI")
        setLoading(id, true);
        clearFeedback()
        try {
            LDAP.connect( LDAP.formatURI(settings.LDAP_URI), true ).then( ( client )=> {
                success(["Connection Established."], id)
            }).catch((err)=>{ error( [String(err)], id ) });
        } catch (err) { error( [String(err)], id ) }
    }
    const ldapAuth = () => {
        const id = testInput("LDAP_AUTH")
        setLoading(id, true);
        clearFeedback()
        try {
            LDAP.login( LDAP.formatURI(settings.LDAP_URI), settings.LDAP_AUTH_USER, settings.LDAP_AUTH_PASS ).then( ( {dn} )=> {
                success([`Bind Successful: ${dn}`], id)
            }).catch((err)=>{ error( [String(err)], id ) });
        } catch (err) { error( [String(err)], id ) }
    }
    const setPrinter = (target) => {
        updateValue('PRINTER',{name : target.Name, port : target.PortName })
    }
    const Printers = printers.map((printer) => {
        return printer.Name && <ListGroup.Item className="pointer" active={settings.PRINTER && settings.PRINTER.name===printer.Name} key={printer.Name} as="li" onClick={()=>{ setPrinter(printer); }} action>{printer.shareName || printer.Name}</ListGroup.Item>
    });
    const saveSettings = () => {
        config.save(settings).then( ()=> {
            console.log("Saved settings.")
            toast.success('Settings Saved.');
            handleClose();
        }).catch((err)=>{ console.error( String(err) ) });
    }
    return (
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton><Modal.Title>Settings</Modal.Title></Modal.Header>
        <Modal.Body>
            <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Theme</Form.Label>
                <InputGroup className="mb-0">
                    <Form.Check checked={settings.DARK}  onChange={e => {updateValue('DARK',e.target.checked); }} type="switch" id="custom-switch" label="Use Dark Mode (Requires App Reload)" />
                </InputGroup>
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">LDAP URI</Form.Label>
                <InputGroup className="mb-0">
                    <Form.Control value={settings.LDAP_URI} disabled={waitingFor.LDAP_URI} onInput={e => {updateValue('LDAP_URI',e.target.value)}} isValid={feedback.response.LDAP_URI} isInvalid={feedback.errors.LDAP_URI} placeholder='ldaps://10.10.1.1:636' />
                    <Button onClick={ldapURI} disabled={waitingFor.LDAP_URI} variant="outline-secondary">{waitingFor.LDAP_URI ? <Spinner animation="border" size="sm"/> : 'Test'}</Button>
                    <Form.Control.Feedback>{feedback.response.LDAP_URI && feedback.response.LDAP_URI[0]}</Form.Control.Feedback> 
                    <Form.Control.Feedback type="invalid" className="m-0">{feedback.errors.LDAP_URI && feedback.errors.LDAP_URI[0]}</Form.Control.Feedback>
                </InputGroup>
                { (!feedback.response.LDAP_URI) && <Form.Text className="text-muted">{waitingFor.LDAP_URI ? `Connecting to ${LDAP.formatURI(settings.LDAP_URI)}...` : "LDAP SSL address URI (eg. ldaps://10.10.1.1:636, domain.wan )"}</Form.Text> }
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">LDAP Login</Form.Label>
                <InputGroup className="mb-0">
                    <Form.Control value={settings.LDAP_AUTH_USER} disabled={waitingFor.LDAP_AUTH} onInput={e => {updateValue('LDAP_AUTH_USER',e.target.value)}} isValid={feedback.response.LDAP_AUTH} isInvalid={feedback.errors.LDAP_AUTH} placeholder='domain\username' />
                    <Form.Control type='password' value={settings.LDAP_AUTH_PASS} disabled={waitingFor.LDAP_AUTH} onInput={e => {updateValue('LDAP_AUTH_PASS',e.target.value)}} isValid={feedback.response.LDAP_AUTH} isInvalid={feedback.errors.LDAP_AUTH} placeholder='password' />
                    <Button onClick={ldapAuth} disabled={waitingFor.LDAP_AUTH} variant="outline-secondary">{waitingFor.LDAP_AUTH ? <Spinner animation="border" size="sm"/> : 'Test'}</Button>
                    <Form.Control.Feedback>{feedback.response.LDAP_AUTH && feedback.response.LDAP_AUTH[0]}</Form.Control.Feedback> 
                    <Form.Control.Feedback type="invalid" className="m-0">{feedback.errors.LDAP_AUTH && feedback.errors.LDAP_AUTH[0]}</Form.Control.Feedback>
                </InputGroup>
                { (!feedback.response.LDAP_AUTH) && <Form.Text className="text-muted">{waitingFor.LDAP_AUTH ? `Connecting as ${settings.LDAP_AUTH}...` : "Credentails used to authenticate with LDAP ( domain\\username or DN )"}</Form.Text> }
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Auto-Print {waitingFor.PRINTERS && <Spinner animation="border" size="sm"/>}</Form.Label>
                <InputGroup className="mb-3">
                    <ListGroup as="ul" style={{width:"100%"}} >
                        {Printers}
                    </ListGroup>
                </InputGroup>
                <FloatingLabel className="mb-3" label="Text Template">
                    <Form.Control value={settings.PRINT_TEMPLATE} onChange={e => {updateValue('PRINT_TEMPLATE',e.target.value)}} as="textarea" style={{ height: '100px' }} />
                </FloatingLabel>
                <FloatingLabel className="mb-3" label="Text Template (if change forced)">
                    <Form.Control value={settings.PRINT_TEMPLATE_F} onChange={e => {updateValue('PRINT_TEMPLATE_F',e.target.value)}}as="textarea" style={{ height: '100px' }} />
                </FloatingLabel>
                <Form.Text className="text-muted">Read documentation for print templating/formatting.</Form.Text>
            </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
          <Button variant="primary" onClick={saveSettings}>Save Changes</Button>
        </Modal.Footer>
      </Modal>
  )
}
