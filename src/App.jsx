import { useState, useEffect } from 'react';
import { Search, MoreVertical, Delete, Phone, Voicemail } from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import { LocalNotifications } from '@capacitor/local-notifications';
import './index.css';

// --- USSD MENU DEFINITIONS ---
const USSD_MENUS = {
  HOME: { text: "Welcome to Bank of Abyssinia Mobile Banking Service. Press * to navigate back anytime, select one of the following options below:\n1: Login\n2: Exit", back: null },
  PIN: { text: "Please enter your PIN to login:", back: 'HOME' },
  PIN_ERROR: { text: "Please enter your PIN to login:\nHave you changed your PIN?", back: 'HOME' },
  
  MAIN_MENU: { text: "Welcome to BOA\n1. My Accounts\n2. Transfer\n3. Transfer to Other Bank\n4. Transfer to Own\n5. Airtime\n6. Utilities\n7. Exchange Rates\n8. More options", back: 'HOME' },
  
  MY_ACCOUNTS: { text: "1: 107988203 - ETB - SAVI.\n2: 128776001 - ETB - AFLA.", back: 'MAIN_MENU' },
  ACC_1_DETAIL: { text: "107988203 - ETB - SAVI.\nCleared Balance is ETB 60.81 and Ledger Balane is ETB 60.81\nTransactions\n1: - 07/05 151.09\n2: - 07/05 200.00\n3: More options", back: 'MY_ACCOUNTS' },
  ACC_2_DETAIL: { text: "128776001 - ETB - AFLA.\nCleared Balance is ETB 50.01 and Ledger Balane is ETB 50.01\nTransactions\n1: - 07/05 101.00\n2: - 07/05 2080.00\n3: More options", back: 'MY_ACCOUNTS' },

  TRANSFER_MENU: { text: "1: Transfer within BOA\n2: ATM withdrawal\n3: Load to TeleBirr\n4: Transfer to M-PESA\n5: Awach\n6: Telebirr Agent", back: 'MAIN_MENU' },
  TRANSFER_BOA_INPUT: { text: "Enter Account No", back: 'TRANSFER_MENU' },
  TRANSFER_BOA_SELECT: { text: "Transfer within BOA\n1: 107988203 - ETB - SAVINGS\n2: 128776001 - ETB - AFLA", back: 'TRANSFER_BOA_INPUT' },
  
  TRANSFER_BOA_AMOUNT: { back: 'TRANSFER_BOA_SELECT' },
  TRANSFER_BOA_REMARK: { back: 'TRANSFER_BOA_AMOUNT' },
  TRANSFER_BOA_CONFIRM: { back: 'TRANSFER_BOA_REMARK' },
  TRANSFER_BOA_SUCCESS: { back: 'MAIN_MENU' },

  ATM_WITHDRAWAL: { text: "ATM withdrawal\n1: 107988203 - ETB - SAVINGS\n2: 128776001 - ETB - AFLA", back: 'TRANSFER_MENU' },
  LOAD_TELEBIRR: { text: "Load to TeleBirr\n1: 107988203 - ETB - SAVINGS\n2: 128776001 - ETB - AFLA", back: 'TRANSFER_MENU' },
  MPESA_INPUT: { text: "Enter M-PESA Registered Number", back: 'TRANSFER_MENU' },

  OTHER_BANK_MENU: { text: "1: IPS Instant Transfer\n2: Non Instant Transfer", back: 'MAIN_MENU' },
  OTHER_BANK_1: { text: "Bank\n1: CBE\n2: Awash\n3: Dashen\n4: Wegagen\n5: Hibret\n6: NIB\n7: More options", back: 'OTHER_BANK_MENU' },
  OTHER_BANK_2: { text: "Bank\n1: COOP\n2: Zemen\n3: Bunna\n4: Global\n5: Enat\n6: Previous options", back: 'OTHER_BANK_1' }
};

// --- HELPER FUNCTIONS ---
const generateTrxId = () => {
  const isLong = Math.random() > 0.5;
  const length = isLong ? 4 : 3;
  let chars = '';
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for(let i=0; i<length; i++) chars += alpha[Math.floor(Math.random() * alpha.length)];
  for(let i=0; i<length; i++) chars += Math.floor(Math.random() * 10).toString();
  
  let arr = chars.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

const getCurrentDate = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
};

// --- MAIN COMPONENT ---
function App() {
  const [number, setNumber] = useState('');
  const [tab, setTab] = useState('keypad'); 
  const [contacts, setContacts] = useState([]);
  const [recents, setRecents] = useState([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  
  const [ussdState, setUssdState] = useState({ visible: false, isLoading: false, step: 'HOME', message: '', input: '', mmiError: false, data: {} });

  const keys = [
    { num: '1', sub: <Voicemail size={14} strokeWidth={2.5} /> }, { num: '2', sub: 'ABC' }, { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' }, { num: '5', sub: 'JKL' }, { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' }, { num: '8', sub: 'TUV' }, { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' }, { num: '0', sub: '+' }, { num: '#', sub: '' }
  ];

  // App Initialization: Permissions & Channels
  useEffect(() => {
    const initSystem = async () => {
      // 1. Force Request Notification Permissions
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // 2. Create High-Priority Channel for Heads-Up Overlays
      await LocalNotifications.createChannel({
        id: 'sms-alerts',
        name: 'SMS Alerts',
        description: 'Bank Transaction Receipts',
        importance: 5, // 5 = MAX (Forces the heads-up popup overlay)
        visibility: 1, // 1 = PUBLIC (Shows on lockscreen)
        vibration: true,
      });

      // 3. Load Contacts if needed
      if (tab === 'contacts' && contacts.length === 0) {
        loadContacts();
      }
    };

    initSystem();
  }, [tab, contacts.length]);

  const handleCall = (numToCall) => {
    if (!numToCall) return;

    if (numToCall === '*815#') {
      setUssdState({ visible: true, isLoading: true, step: 'HOME', message: '', input: '', mmiError: false, data: {} });
      setTimeout(() => {
        setUssdState({ visible: true, isLoading: false, step: 'HOME', message: USSD_MENUS.HOME.text, input: '', mmiError: false, data: {} });
      }, 2000);
      return;
    }
    
    setRecents(prev => [{ num: numToCall, time: new Date().toLocaleTimeString() }, ...prev]);
    
    if (window.plugins && window.plugins.CallNumber) {
      window.plugins.CallNumber.callNumber(() => {}, () => {}, numToCall, true);
    } else {
      window.open(`tel:${numToCall.replace('#', '%23')}`, '_system');
    }
  };

  const closeUssd = () => {
    setUssdState({ visible: false, isLoading: false, step: 'HOME', message: '', input: '', mmiError: false, data: {} });
    setNumber('');
  };

  const getMessageForStep = (step, data) => {
    switch(step) {
      case 'TRANSFER_BOA_AMOUNT':
        return `ESUBALEW AND TENAGNEWORK AND DESALE Requst Debit From ${data.source} For ${data.target}\nEnter Amount`;
      case 'TRANSFER_BOA_REMARK':
        return `ESUBALEW AND TENAGNEWORK AND DESALE Requst Debit From ${data.source} For ${data.target}\nEnter Remark`;
      case 'TRANSFER_BOA_CONFIRM':
        return `Please Confirm\nRequest From ${data.source} For ${data.target}.\nAmount: ${data.amount}\nRemark: ${data.remark}\n1: Yes\n2: No`;
      case 'TRANSFER_BOA_SUCCESS':
        return `Complete\nETB ${parseFloat(data.amount).toFixed(2)} debited from ${data.source} For 233818817 (ok done via Mobile) on ${getCurrentDate()} with transaction ID: FT26${data.trxId}`;
      default:
        return USSD_MENUS[step]?.text || '';
    }
  };

  const handleUssdSubmit = () => {
    const input = ussdState.input.trim();
    const currentStep = ussdState.step;
    let nextData = { ...ussdState.data };

    let nextStep = currentStep;
    let shouldClose = false;
    let mmiError = false;
    let processingDelay = 1200; 

    if (input === '*') {
      const backStep = USSD_MENUS[currentStep]?.back;
      if (backStep) {
        nextStep = backStep;
      } else {
        shouldClose = true;
      }
    } else {
      switch (currentStep) {
        case 'HOME':
          if (input === '1') nextStep = 'PIN';
          else if (input === '2') shouldClose = true;
          break;
        case 'PIN':
        case 'PIN_ERROR':
          if (input === '6085') nextStep = 'MAIN_MENU';
          else nextStep = 'PIN_ERROR';
          break;
        case 'MAIN_MENU':
          if (input === '1') nextStep = 'MY_ACCOUNTS';
          else if (input === '2') nextStep = 'TRANSFER_MENU';
          else if (input === '3') nextStep = 'OTHER_BANK_MENU';
          else shouldClose = true; 
          break;
        case 'MY_ACCOUNTS':
          if (input === '1') nextStep = 'ACC_1_DETAIL';
          else if (input === '2') nextStep = 'ACC_2_DETAIL';
          else shouldClose = true;
          break;
        
        case 'TRANSFER_MENU':
          if (input === '1') nextStep = 'TRANSFER_BOA_INPUT';
          else if (input === '2') nextStep = 'ATM_WITHDRAWAL';
          else if (input === '3') nextStep = 'LOAD_TELEBIRR';
          else if (input === '4') nextStep = 'MPESA_INPUT';
          else shouldClose = true;
          break;

        case 'TRANSFER_BOA_INPUT':
          if (input === '233818817') {
            nextStep = 'TRANSFER_BOA_SELECT';
            nextData.target = input;
          } else {
            shouldClose = true; 
          }
          break;

        case 'TRANSFER_BOA_SELECT':
          if (input === '1' || input === '2') {
            nextStep = 'TRANSFER_BOA_AMOUNT';
            nextData.source = input === '1' ? '107988203' : '128776001';
          } else shouldClose = true;
          break;

        case 'TRANSFER_BOA_AMOUNT':
          if (input) {
            nextStep = 'TRANSFER_BOA_REMARK';
            nextData.amount = input;
          } else shouldClose = true;
          break;

        case 'TRANSFER_BOA_REMARK':
          if (input) {
            nextStep = 'TRANSFER_BOA_CONFIRM';
            nextData.remark = input;
          } else shouldClose = true;
          break;

        case 'TRANSFER_BOA_CONFIRM':
          if (input === '1') {
            nextStep = 'TRANSFER_BOA_SUCCESS';
            processingDelay = 3500; 
            nextData.trxId = generateTrxId();
          } else if (input === '2') {
            shouldClose = true;
          } else shouldClose = true;
          break;

        case 'TRANSFER_BOA_SUCCESS':
          shouldClose = true;
          break;

        case 'MPESA_INPUT':
          if (input.length > 0) mmiError = true;
          break;

        case 'OTHER_BANK_MENU':
          if (input === '1' || input === '2') nextStep = 'OTHER_BANK_1';
          else shouldClose = true;
          break;
        case 'OTHER_BANK_1':
          if (input === '7') nextStep = 'OTHER_BANK_2';
          else shouldClose = true;
          break;
        case 'OTHER_BANK_2':
          if (input === '6') nextStep = 'OTHER_BANK_1';
          else shouldClose = true;
          break;
        default:
          shouldClose = true;
          break;
      }
    }

    setUssdState(prev => ({ ...prev, visible: false }));

    setTimeout(() => {
      if (mmiError) {
        setUssdState({ visible: false, isLoading: false, step: 'HOME', message: '', input: '', data: {}, mmiError: true });
      } else if (shouldClose) {
        closeUssd();
      } else {
        const generatedMessage = getMessageForStep(nextStep, nextData);
        setUssdState({ visible: true, isLoading: false, step: nextStep, message: generatedMessage, input: '', data: nextData, mmiError: false });
        
        // --- SCHEDULE HIGH-PRIORITY NOTIFICATION ---
        if (nextStep === 'TRANSFER_BOA_SUCCESS') {
          LocalNotifications.schedule({
            notifications: [
              {
                title: "BOA",
                body: `Dear Daniel, your account 1*******1 was debited with ETB ${parseFloat(nextData.amount).toFixed(2)}. Available Balance: ETB 50.81. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26${nextData.trxId} Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.`,
                id: Math.floor(Math.random() * 100000), 
                schedule: { at: new Date(Date.now() + 5000) }, 
                channelId: 'sms-alerts', // Links to the MAX importance channel created in useEffect
                sound: null, 
                smallIcon: "ic_sms_notification", 
              }
            ]
          });
        }
      }
    }, processingDelay);
  };

  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      let perm = await Contacts.checkPermissions();
      if (perm.contacts !== 'granted') perm = await Contacts.requestPermissions();
      if (perm.contacts === 'granted') {
        const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
        setContacts(result.contacts || []);
      }
    } catch (error) {
      console.error('Failed to load contacts', error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h2>Phone</h2>
        <div className="header-icons">
          <Search size={22} strokeWidth={2.5} />
          <MoreVertical size={22} strokeWidth={2.5} />
        </div>
      </header>

      {tab === 'keypad' && (
        <>
          <div className="display">
            {number}
            {number && (
              <span className="backspace" style={{ display: 'flex' }} onClick={() => setNumber(prev => prev.slice(0, -1))}>
                <Delete size={32} strokeWidth={1.5} />
              </span>
            )}
          </div>

          <div className="keypad">
            {keys.map((key, index) => (
              <button key={index} className="btn" onClick={() => setNumber(prev => prev.length < 15 ? prev + key.num : prev)}>
                <span className="num">{key.num}</span>
                {key.sub && <span className="sub">{key.sub}</span>}
              </button>
            ))}
          </div>

          <div className="call-bar">
            <div className="sim-buttons">
              <button className="sim-btn sim-1" onClick={() => handleCall(number)}>
                <Phone size={24} fill="currentColor" stroke="none" /> <span className="sim-badge">1</span>
              </button>
              <button className="sim-btn sim-2" onClick={() => handleCall(number)}>
                <Phone size={24} fill="currentColor" stroke="none" /> <span className="sim-badge">2</span>
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'recents' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {recents.map((r, i) => (
            <div key={i} onClick={() => handleCall(r.num)} style={{ padding: '15px 0', borderBottom: '1px solid #333' }}>
              <div style={{ fontSize: '1.5rem', fontFamily: 'system-ui' }}>{r.num}</div>
              <div style={{ color: '#888', fontSize: '0.9rem', fontFamily: 'system-ui' }}>{r.time} • App Call</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'contacts' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {isLoadingContacts ? <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Loading...</div> : 
            contacts.map((c, i) => (
              <div key={i} onClick={() => handleCall(c.phones?.[0]?.number)} style={{ padding: '15px 0', borderBottom: '1px solid #333' }}>
                <div style={{ fontSize: '1.5rem', fontFamily: 'system-ui' }}>{c.name?.display || 'Unknown'}</div>
                <div style={{ color: '#888', fontSize: '1rem', fontFamily: 'system-ui' }}>{c.phones?.[0]?.number || 'No number'}</div>
              </div>
            ))
          }
        </div>
      )}

      <nav className="bottom-nav">
        <span className={`nav-item ${tab === 'keypad' ? 'active' : ''}`} onClick={() => setTab('keypad')}>Keypad</span>
        <span className={`nav-item ${tab === 'recents' ? 'active' : ''}`} onClick={() => setTab('recents')}>Recents</span>
        <span className={`nav-item ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>Contacts</span>
      </nav>

      {ussdState.visible && (
        <>
          {ussdState.isLoading ? (
            <div className="ussd-loading-toast">
              <div className="spinner">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <span>USSD code running...</span>
            </div>
          ) : (
            <div className="ussd-overlay">
              <div className="ussd-box">
                <div className="ussd-text">{ussdState.message}</div>
                <input 
                  type="text" 
                  className="ussd-input" 
                  autoFocus
                  value={ussdState.input} 
                  onChange={(e) => setUssdState({...ussdState, input: e.target.value})} 
                  onKeyDown={(e) => e.key === 'Enter' && handleUssdSubmit()}
                />
                <div className="ussd-actions">
                  <button className="ussd-btn" onClick={closeUssd}>Cancel</button>
                  <button className="ussd-btn" onClick={handleUssdSubmit}>Send</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {ussdState.mmiError && (
        <div className="mmi-error-overlay">
          <div className="mmi-error-box">
            <div className="mmi-text">Connection problem or invalid MMI code.</div>
            <button className="mmi-btn" onClick={closeUssd}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;