import { useState, useEffect } from 'react';
import { Search, MoreVertical, Delete, Phone, Voicemail, Info, PhoneIncoming, PhoneOutgoing, PhoneMissed, ArrowLeft, Copy, Share2, Settings, Plus, Save, Upload, Download, User, MessageSquare } from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import { LocalNotifications } from '@capacitor/local-notifications';
import boaLogo from './assets/BOA.png'; 
import './index.css';

const generateTrxId = () => {
  const length = Math.random() > 0.5 ? 4 : 3;
  let chars = '';
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for(let i=0; i<length; i++) chars += alpha[Math.floor(Math.random() * alpha.length)];
  for(let i=0; i<length; i++) chars += Math.floor(Math.random() * 10).toString();
  return chars.split('').sort(() => 0.5 - Math.random()).join('');
};

const getCurrentDate = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
};

const DEFAULT_CONFIG = {
  pin: '6085',
  userName: 'Daniel',
  myAccounts: [
    { number: '107988203', label: 'ETB - SAVINGS', balance: 60.81 },
    { number: '128776001', label: 'ETB - AFLA', balance: 50.01 }
  ],
  savedAccounts: [
    { number: '233818817', name: 'ESUBALEW AND TENAGNEWORK AND DESALE' }
  ]
};

function App() {
  const [number, setNumber] = useState('');
  const [tab, setTab] = useState('keypad'); 
  const [contacts, setContacts] = useState([]);
  const [recents, setRecents] = useState([]);
  const [recentsFilter, setRecentsFilter] = useState('all'); 
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingRecents, setIsLoadingRecents] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  
  const [ussdState, setUssdState] = useState({ visible: false, isLoading: false, step: 'HOME', message: '', input: '', mmiError: false, data: {} });
  const [activeSmsView, setActiveSmsView] = useState(null); 

  const [config, setConfig] = useState(() => {
    const cached = localStorage.getItem('ussd_admin_config');
    return cached ? JSON.parse(cached) : DEFAULT_CONFIG;
  });
  
  const [smsList, setSmsList] = useState(() => {
    const cached = localStorage.getItem('ussd_sms_cache');
    return cached ? JSON.parse(cached) : [];
  });

  const [deviceSms, setDeviceSms] = useState([]);
  const [isLoadingSms, setIsLoadingSms] = useState(false);
  
  const [importData, setImportData] = useState('');

  useEffect(() => {
    localStorage.setItem('ussd_admin_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('ussd_sms_cache', JSON.stringify(smsList));
  }, [smsList]);

  const keys = [
    { num: '1', sub: <Voicemail size={14} strokeWidth={2.5} /> }, { num: '2', sub: 'ABC' }, { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' }, { num: '5', sub: 'JKL' }, { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' }, { num: '8', sub: 'TUV' }, { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' }, { num: '0', sub: '+' }, { num: '#', sub: '' }
  ];

  useEffect(() => {
    const initSystem = async () => {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') await LocalNotifications.requestPermissions();
      await LocalNotifications.createChannel({
        id: 'sms-alerts', name: 'SMS Alerts', description: 'Bank Receipts', importance: 5, visibility: 1, vibration: true,
      });
    };
    initSystem();

    let notifListener;
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const body = action.notification.body || '';
      setActiveSmsView({ 
        sender: action.notification.title || 'Notification', 
        body: body,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      });
    }).then(listener => { notifListener = listener; });

    return () => { if (notifListener) notifListener.remove(); };
  }, []);

  useEffect(() => {
    if (tab === 'contacts' && contacts.length === 0) loadContacts();
    if (tab === 'recents' && recents.length === 0) loadCallLogs();
    if (tab === 'messages' && deviceSms.length === 0) loadDeviceSms();
  }, [tab]);

  const loadDeviceSms = () => {
    if (!window.SMS) return; // Fails silently if plugin isn't installed
    setIsLoadingSms(true);
    window.SMS.hasPermission((hasPerm) => {
      if (hasPerm) fetchActualSms();
      else window.SMS.requestPermission(() => fetchActualSms(), () => setIsLoadingSms(false));
    }, () => setIsLoadingSms(false));
  };

  const fetchActualSms = () => {
    window.SMS.listSMS({ box: 'inbox', maxCount: 150 }, (data) => {
      const formatted = (data || []).map(s => ({
        id: s._id || Math.random().toString(),
        sender: s.address,
        body: s.body,
        time: new Date(s.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })
      }));
      setDeviceSms(formatted);
      setIsLoadingSms(false);
    }, () => setIsLoadingSms(false));
  };

  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      let status = await Contacts.checkPermissions();
      if (status.contacts !== 'granted') {
        status = await Contacts.requestPermissions();
      }
      
      if (status.contacts === 'granted') {
        const result = await Contacts.getContacts(); 
        const rawContacts = result.contacts || [];
        const normalized = rawContacts.map(c => ({
          name: c.name?.display || c.displayName || 'Unknown',
          phone: (c.phones && c.phones.length > 0) ? c.phones[0].number : 
                 (c.phoneNumbers && c.phoneNumbers.length > 0) ? c.phoneNumbers[0].number : null
        })).filter(c => c.phone !== null); 

        setContacts(normalized.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const loadCallLogs = () => {
    if (window.plugins && window.plugins.callLog) {
      setIsLoadingRecents(true);
      window.plugins.callLog.hasReadPermission((hasPerm) => {
        if (!hasPerm) window.plugins.callLog.requestReadPermission(() => fetchLogs(), () => setIsLoadingRecents(false));
        else fetchLogs();
      });
    }
  };

  const fetchLogs = () => {
    window.plugins.callLog.getCallLog([], (data) => { setRecents(data || []); setIsLoadingRecents(false); }, () => setIsLoadingRecents(false));
  };

  const handleCall = (numToCall) => {
    if (!numToCall) return;
    
    if (numToCall === '*#666*#') {
      setTab('admin');
      setNumber('');
      return;
    }

    if (numToCall === '*815#') {
      setUssdState({ visible: true, isLoading: true, step: 'HOME', message: '', input: '', mmiError: false, data: {} });
      setTimeout(() => setUssdState({ visible: true, isLoading: false, step: 'HOME', message: getMessageForStep('HOME', {}), input: '', mmiError: false, data: {} }), 2000);
      return;
    }
    
    if (!window.plugins || !window.plugins.callLog) setRecents(prev => [{ num: numToCall, time: new Date().toLocaleTimeString(), type: 2 }, ...prev]);
    if (window.plugins && window.plugins.CallNumber) window.plugins.CallNumber.callNumber(() => {}, () => {}, numToCall, true);
    else window.open(`tel:${numToCall.replace('#', '%23')}`, '_system');
  };

  const closeUssd = () => { setUssdState({ visible: false, isLoading: false, step: 'HOME', message: '', input: '', mmiError: false, data: {} }); setNumber(''); };

  const getTargetName = (num) => {
    const acc = config.savedAccounts.find(a => a.number === num);
    return acc ? acc.name : "UNKNOWN ACCOUNT";
  };

  const getMessageForStep = (step, data) => {
    switch(step) {
      case 'HOME': return "Welcome to Bank of Abyssinia Mobile Banking Service. Press * to navigate back anytime, select one of the following options below:\n1: Login\n2: Exit";
      case 'PIN': return "Please enter your PIN to login:";
      case 'PIN_ERROR': return "Please enter your PIN to login:\nHave you changed your PIN?";
      case 'MAIN_MENU': return "Welcome to BOA\n1. My Accounts\n2. Transfer\n3. Transfer to Other Bank\n4. Transfer to Own\n5. Airtime\n6. Utilities\n7. Exchange Rates\n8. More options";
      case 'MY_ACCOUNTS': return config.myAccounts.map((a, i) => `${i+1}: ${a.number} - ${a.label}\nBalance: ETB ${parseFloat(a.balance).toFixed(2)}`).join('\n\n') + `\n\n${config.myAccounts.length + 1}: Back`;
      case 'TRANSFER_MENU': return "1: Transfer within BOA\n2: ATM withdrawal\n3: Load to TeleBirr\n4: Transfer to M-PESA\n5: Awach\n6: Telebirr Agent";
      case 'TRANSFER_BOA_INPUT': return "Enter Account No";
      case 'TRANSFER_BOA_SELECT': return "Transfer within BOA\n" + config.myAccounts.map((a, i) => `${i+1}: ${a.number} - ${a.label}`).join('\n');
      case 'TRANSFER_BOA_AMOUNT': return `${getTargetName(data.target)} Request Debit From ${data.source} For ${data.target}\nEnter Amount`;
      case 'TRANSFER_BOA_REMARK': return `${getTargetName(data.target)} Request Debit From ${data.source} For ${data.target}\nEnter Remark`;
      case 'TRANSFER_BOA_CONFIRM': return `Please Confirm\nRequest From ${data.source} For ${data.target}.\nAmount: ${data.amount}\nRemark: ${data.remark}\n1: Yes\n2: No`;
      case 'TRANSFER_BOA_SUCCESS': return `Complete\nETB ${parseFloat(data.amount).toFixed(2)} debited from ${data.source} For ${data.target} (ok done via Mobile) on ${getCurrentDate()} with transaction ID: FT26${data.trxId}`;
      case 'ATM_WITHDRAWAL': return "ATM withdrawal\n" + config.myAccounts.map((a, i) => `${i+1}: ${a.number} - ${a.label}`).join('\n');
      case 'LOAD_TELEBIRR': return "Load to TeleBirr\n" + config.myAccounts.map((a, i) => `${i+1}: ${a.number} - ${a.label}`).join('\n');
      case 'MPESA_INPUT': return "Enter M-PESA Registered Number";
      case 'OTHER_BANK_MENU': return "1: IPS Instant Transfer\n2: Non Instant Transfer";
      case 'OTHER_BANK_1': return "Bank\n1: CBE\n2: Awash\n3: Dashen\n4: Wegagen\n5: Hibret\n6: NIB\n7: More options";
      case 'OTHER_BANK_2': return "Bank\n1: COOP\n2: Zemen\n3: Bunna\n4: Global\n5: Enat\n6: Previous options";
      default: return "";
    }
  };

  const handleUssdSubmit = () => {
    const input = ussdState.input.trim();
    if (input === '') {
      setUssdState(prev => ({ ...prev, visible: false }));
      setShowWarning(true); setTimeout(() => { setShowWarning(false); closeUssd(); }, 3000); return;
    }
    
    let nextStep = ussdState.step, shouldClose = false, mmiError = false, processingDelay = 1200; 
    let nextData = { ...ussdState.data };

    if (input === '*') {
      if (['PIN', 'PIN_ERROR'].includes(ussdState.step)) nextStep = 'HOME';
      else if (['MY_ACCOUNTS', 'TRANSFER_MENU', 'OTHER_BANK_MENU'].includes(ussdState.step)) nextStep = 'MAIN_MENU';
      else if (['TRANSFER_BOA_INPUT', 'ATM_WITHDRAWAL', 'LOAD_TELEBIRR', 'MPESA_INPUT'].includes(ussdState.step)) nextStep = 'TRANSFER_MENU';
      else if (['TRANSFER_BOA_SELECT'].includes(ussdState.step)) nextStep = 'TRANSFER_BOA_INPUT';
      else if (['TRANSFER_BOA_AMOUNT'].includes(ussdState.step)) nextStep = 'TRANSFER_BOA_SELECT';
      else if (['TRANSFER_BOA_REMARK'].includes(ussdState.step)) nextStep = 'TRANSFER_BOA_AMOUNT';
      else if (['TRANSFER_BOA_CONFIRM'].includes(ussdState.step)) nextStep = 'TRANSFER_BOA_REMARK';
      else shouldClose = true;
    } else {
      switch (ussdState.step) {
        case 'HOME': input === '1' ? nextStep = 'PIN' : shouldClose = true; break;
        case 'PIN': case 'PIN_ERROR': input === config.pin ? nextStep = 'MAIN_MENU' : nextStep = 'PIN_ERROR'; break;
        case 'MAIN_MENU': input === '1' ? nextStep = 'MY_ACCOUNTS' : input === '2' ? nextStep = 'TRANSFER_MENU' : input === '3' ? nextStep = 'OTHER_BANK_MENU' : shouldClose = true; break;
        case 'MY_ACCOUNTS': shouldClose = true; break; 
        case 'TRANSFER_MENU': input === '1' ? nextStep = 'TRANSFER_BOA_INPUT' : input === '2' ? nextStep = 'ATM_WITHDRAWAL' : input === '3' ? nextStep = 'LOAD_TELEBIRR' : input === '4' ? nextStep = 'MPESA_INPUT' : shouldClose = true; break;
        case 'TRANSFER_BOA_INPUT': nextStep = 'TRANSFER_BOA_SELECT'; nextData.target = input; break;
        case 'TRANSFER_BOA_SELECT': 
          const accIdx = parseInt(input) - 1;
          if (accIdx >= 0 && accIdx < config.myAccounts.length) { nextStep = 'TRANSFER_BOA_AMOUNT'; nextData.source = config.myAccounts[accIdx].number; } else { shouldClose = true; }
          break;
        case 'TRANSFER_BOA_AMOUNT': input ? (nextStep = 'TRANSFER_BOA_REMARK', nextData.amount = input) : shouldClose = true; break;
        case 'TRANSFER_BOA_REMARK': input ? (nextStep = 'TRANSFER_BOA_CONFIRM', nextData.remark = input) : shouldClose = true; break;
        case 'TRANSFER_BOA_CONFIRM': 
          if (input === '1') {
            nextStep = 'TRANSFER_BOA_SUCCESS'; 
            processingDelay = 3500; 
            nextData.trxId = generateTrxId();
            
            const transferAmt = parseFloat(nextData.amount);
            const sourceIndex = config.myAccounts.findIndex(a => a.number === nextData.source);
            let newBalance = 0;
            
            if (sourceIndex !== -1) {
              newBalance = (parseFloat(config.myAccounts[sourceIndex].balance) || 0) - transferAmt;
              const updatedAccs = [...config.myAccounts];
              updatedAccs[sourceIndex].balance = newBalance;
              setConfig({...config, myAccounts: updatedAccs}); 
            }
            nextData.remainingBalance = newBalance;

            const smsBody = `Dear ${config.userName}, your account 1*******1 was debited with ETB ${transferAmt.toFixed(2)}. Available Balance: ETB ${newBalance.toFixed(2)}. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26${nextData.trxId}`;
            
            const newSms = {
              id: Date.now().toString(),
              sender: 'BOA',
              title: 'Bank of Abyssinia',
              body: smsBody,
              time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            };
            setSmsList(prev => [newSms, ...prev]);

          } else {
            shouldClose = true;
          }
          break;
        case 'TRANSFER_BOA_SUCCESS': shouldClose = true; break;
        case 'MPESA_INPUT': if (input.length > 0) mmiError = true; break;
        case 'OTHER_BANK_MENU': (input === '1' || input === '2') ? nextStep = 'OTHER_BANK_1' : shouldClose = true; break;
        case 'OTHER_BANK_1': input === '7' ? nextStep = 'OTHER_BANK_2' : shouldClose = true; break;
        case 'OTHER_BANK_2': input === '6' ? nextStep = 'OTHER_BANK_1' : shouldClose = true; break;
        default: shouldClose = true; break;
      }
    }

    setUssdState(prev => ({ ...prev, visible: false }));
    setTimeout(() => {
      if (mmiError) { setUssdState({ visible: false, isLoading: false, step: 'HOME', message: '', input: '', data: {}, mmiError: true }); } 
      else if (shouldClose) { closeUssd(); } 
      else {
        setUssdState({ visible: true, isLoading: false, step: nextStep, message: getMessageForStep(nextStep, nextData), input: '', data: nextData, mmiError: false });
        if (nextStep === 'TRANSFER_BOA_SUCCESS') {
          const pushBody = `Dear ${config.userName}, your account 1*******1 was debited with ETB ${parseFloat(nextData.amount).toFixed(2)}. Available Balance: ETB ${parseFloat(nextData.remainingBalance).toFixed(2)}. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26${nextData.trxId}`;
          LocalNotifications.schedule({
            notifications: [{
              title: "BOA",
              body: pushBody,
              id: Math.floor(Math.random() * 100000), schedule: { at: new Date(Date.now() + 5000) }, channelId: 'sms-alerts', smallIcon: "ic_sms_notification",
            }]
          });
        }
      }
    }, processingDelay);
  };

  const renderCallIcon = (type) => {
    switch(parseInt(type)) {
      case 1: return <PhoneIncoming size={16} color="#4caf50" />;
      case 2: return <PhoneOutgoing size={16} color="#888" />;
      case 3: case 5: return <PhoneMissed size={16} color="#ff3b30" />;
      default: return <Phone size={16} color="#888" />;
    }
  };

  if (activeSmsView) {
    return (
      <div className="app bg-dark" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', color: '#fff' }}>
        <header style={{ padding: '20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #222', background: '#111' }}>
          <ArrowLeft size={24} onClick={() => setActiveSmsView(null)} style={{ cursor: 'pointer', marginRight: '15px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px' }}><User size={18}/></div>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{activeSmsView.sender || 'Unknown Sender'}</h2>
          </div>
        </header>
        
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ alignSelf: 'center', fontSize: '0.8rem', color: '#888', marginBottom: '20px' }}>
            {activeSmsView.time || 'Today'}
          </div>
          
          <div style={{ alignSelf: 'flex-start', background: '#262628', padding: '15px', borderRadius: '18px', borderBottomLeftRadius: '4px', maxWidth: '85%', lineHeight: '1.4' }}>
            <p style={{ margin: 0, wordWrap: 'break-word' }}>{activeSmsView.body}</p>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px', marginLeft: '5px' }}>
            <button onClick={() => navigator.clipboard.writeText(activeSmsView.body)} style={{ background: 'transparent', border: 'none', color: '#0a84ff', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: 0 }}>
              <Copy size={16}/> Copy
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allMessages = [...smsList, ...deviceSms];

  return (
    <div className="app">
      <header className="header">
        <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
        <div className="header-icons"><Search size={22} /><MoreVertical size={22} /></div>
      </header>

      {tab === 'keypad' && (
        <>
          <div className="display">
            {number}
            {number && <span className="backspace" onClick={() => setNumber(prev => prev.slice(0, -1))}><Delete size={32} /></span>}
          </div>
          <div className="keypad">
            {keys.map((k, i) => (
              <button key={i} className="btn" onClick={() => setNumber(prev => prev.length < 15 ? prev + k.num : prev)}>
                <span className="num">{k.num}</span>{k.sub && <span className="sub">{k.sub}</span>}
              </button>
            ))}
          </div>
          <div className="call-bar">
            <div className="sim-buttons">
              <button className="sim-btn sim-1" onClick={() => handleCall(number)}><Phone size={24} fill="currentColor" stroke="none" /></button>
              
            </div>
          </div>
        </>
      )}

      {tab === 'recents' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: '10px', margin: '15px 0' }}>
            <button onClick={() => setRecentsFilter('all')} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: recentsFilter === 'all' ? '#333' : 'transparent', color: 'white', border: '1px solid #444' }}>All</button>
            <button onClick={() => setRecentsFilter('missed')} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: recentsFilter === 'missed' ? '#333' : 'transparent', color: 'white', border: '1px solid #444' }}>Missed</button>
          </div>
          {isLoadingRecents ? <div style={{textAlign:'center', color:'#888'}}>Loading...</div> : 
            (recentsFilter === 'missed' ? recents.filter(r => r.type == 3 || r.type == 5) : recents).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #333' }}>
                <div style={{ flex: 1 }} onClick={() => handleCall(r.number || r.num)}>
                  <div style={{ fontSize: '1.2rem', color: (r.type == 3 || r.type == 5) ? '#ff3b30' : 'white', fontWeight: '500' }}>{r.cachedName || r.name || r.number || r.num}</div>
                  <div style={{ color: '#888', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    {renderCallIcon(r.type)} {r.date ? new Date(parseInt(r.date)).toLocaleString() : r.time}
                  </div>
                </div>
                <div style={{ padding: '10px', color: '#007aff' }}><Info size={22} /></div>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'contacts' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {isLoadingContacts ? (
            <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Loading...</div>
          ) : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
              No contacts found. 
            </div>
          ) : (
            contacts.map((c, i) => (
              <div key={i} onClick={() => handleCall(c.phone)} style={{ padding: '15px 0', borderBottom: '1px solid #333' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '500', color: '#fff' }}>{c.name}</div>
                <div style={{ color: '#888', marginTop: '4px' }}>{c.phone}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'messages' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', background: '#000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
             <h3 style={{ margin: 0, color: '#fff' }}>SMS</h3>
             {window.SMS && (
               <button onClick={loadDeviceSms} style={{ background: '#333', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize: '0.8rem' }}>
                 {isLoadingSms ? 'Syncing...' : 'Sync Phone SMS'}
               </button>
             )}
          </div>
          
          {allMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>No messages found.</div>
          ) : (
            allMessages.map((sms) => (
              <div key={sms.id} onClick={() => setActiveSmsView(sms)} style={{ display: 'flex', padding: '15px 0', borderBottom: '1px solid #222', cursor: 'pointer' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>
                  <MessageSquare size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                      {sms.sender}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' }}>{sms.time}</span>
                  </div>
                  <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sms.body}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'admin' && (
        <div className="admin-container">
          <div className="admin-section">
            <h3><User size={18}/> Profile & Security</h3>
            <div className="admin-row" style={{marginBottom: '10px'}}>
              <label>SMS Username:</label>
              <input type="text" value={config.userName} onChange={(e) => setConfig({...config, userName: e.target.value})} className="admin-input" />
            </div>
            <div className="admin-row">
              <label>USSD Login PIN:</label>
              <input type="text" value={config.pin} onChange={(e) => setConfig({...config, pin: e.target.value})} className="admin-input" />
            </div>
          </div>

          <div className="admin-section">
            <h3>My Accounts (Source)</h3>
            {config.myAccounts.map((acc, idx) => (
              <div key={idx} className="admin-item" style={{flexWrap: 'wrap'}}>
                <input value={acc.number} onChange={e => { const newAccs = [...config.myAccounts]; newAccs[idx].number = e.target.value; setConfig({...config, myAccounts: newAccs}); }} placeholder="Account No." className="admin-input flex-1" />
                <input value={acc.label} onChange={e => { const newAccs = [...config.myAccounts]; newAccs[idx].label = e.target.value; setConfig({...config, myAccounts: newAccs}); }} placeholder="Label (e.g. SAVINGS)" className="admin-input flex-1" />
                <input value={acc.balance} type="number" onChange={e => { const newAccs = [...config.myAccounts]; newAccs[idx].balance = e.target.value; setConfig({...config, myAccounts: newAccs}); }} placeholder="Balance" className="admin-input" style={{width: '80px'}} />
                <button onClick={() => { const newAccs = config.myAccounts.filter((_, i) => i !== idx); setConfig({...config, myAccounts: newAccs}); }} className="admin-btn-icon danger"><Delete size={18}/></button>
              </div>
            ))}
            <button onClick={() => setConfig({...config, myAccounts: [...config.myAccounts, {number: '', label: 'ETB - ', balance: 0}]})} className="admin-btn full-width mt-2"><Plus size={16}/> Add My Account</button>
          </div>

          <div className="admin-section">
            <h3>Saved Beneficiaries (Target)</h3>
            {config.savedAccounts.map((acc, idx) => (
              <div key={idx} className="admin-item column">
                <div style={{display:'flex', gap:'10px', width:'100%'}}>
                  <input value={acc.number} onChange={e => { const newAccs = [...config.savedAccounts]; newAccs[idx].number = e.target.value; setConfig({...config, savedAccounts: newAccs}); }} placeholder="Account No." className="admin-input flex-1" />
                  <button onClick={() => { const newAccs = config.savedAccounts.filter((_, i) => i !== idx); setConfig({...config, savedAccounts: newAccs}); }} className="admin-btn-icon danger"><Delete size={18}/></button>
                </div>
                <input value={acc.name} onChange={e => { const newAccs = [...config.savedAccounts]; newAccs[idx].name = e.target.value; setConfig({...config, savedAccounts: newAccs}); }} placeholder="Full Name" className="admin-input full-width mt-2" />
              </div>
            ))}
            <button onClick={() => setConfig({...config, savedAccounts: [...config.savedAccounts, {number: '', name: ''}]})} className="admin-btn full-width mt-2"><Plus size={16}/> Add Beneficiary</button>
          </div>

          <div className="admin-section">
            <h3><Save size={18}/> Backup & Restore</h3>
            <textarea value={importData} onChange={(e) => setImportData(e.target.value)} className="admin-textarea" placeholder="Paste JSON data here to import..."></textarea>
            <div className="admin-actions">
              <button onClick={() => setImportData(JSON.stringify(config, null, 2))} className="admin-btn"><Download size={16}/> Export</button>
              <button onClick={() => { try { setConfig(JSON.parse(importData)); alert("Imported!"); } catch { alert("Invalid JSON"); } }} className="admin-btn primary"><Upload size={16}/> Import</button>
            </div>
          </div>
          <br/><br/><br/>
        </div>
      )}

      <nav className="bottom-nav">
        <span className={`nav-item ${tab === 'keypad' ? 'active' : ''}`} onClick={() => setTab('keypad')}>Keypad</span>
        <span className={`nav-item ${tab === 'recents' ? 'active' : ''}`} onClick={() => setTab('recents')}>Recents</span>
        <span className={`nav-item ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>Contacts</span>
        <span className={`nav-item ${tab === 'messages' ? 'active' : ''}`} onClick={() => setTab('messages')}>SMS</span>
      </nav>

      {ussdState.visible && (
        <div className={ussdState.isLoading ? "ussd-loading-toast" : "ussd-overlay"}>
          {ussdState.isLoading ? (
            <><div className="spinner"><div className="dot"/><div className="dot"/><div className="dot"/><div className="dot"/></div><span>USSD code running...</span></>
          ) : (
            <div className="ussd-box">
              <div className="ussd-text">{ussdState.message}</div>
              <input type="text" className="ussd-input" autoFocus value={ussdState.input} onChange={(e) => setUssdState({...ussdState, input: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleUssdSubmit()} />
              <div className="ussd-actions">
                <button className="ussd-btn" onClick={closeUssd}>Cancel</button>
                <button className="ussd-btn" onClick={handleUssdSubmit}>Send</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showWarning && <div className="warning-modal">Input required. Try Again</div>}
      {ussdState.mmiError && <div className="mmi-error-overlay"><div className="mmi-error-box"><div className="mmi-text">Connection problem or invalid MMI code.</div><button className="mmi-btn" onClick={closeUssd}>OK</button></div></div>}
    </div>
  );
}

export default App;