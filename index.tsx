import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Typen für unsere Daten
interface Trip {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  licensePlate: string;
  payment: 'cash' | 'invoice';
  amount: number;
  settled: boolean;
  notes?: string;
  ownAccount?: boolean;
  driverId?: string;
  driverName?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  reimbursed: boolean;
  driverId?: string;
  driverName?: string;
}

interface User {
  id: string;
  name: string;
  role: 'driver' | 'boss';
  password: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  driverId: string;
  driverName: string;
  date: string;
  status: 'open' | 'closed';
}

// Dummy-Daten für Benutzer
const USERS: User[] = [
  { id: '1', name: 'Max Mustermann', role: 'driver', password: 'fahrer123' },
  { id: '2', name: 'Anna Schmidt', role: 'driver', password: 'fahrer456' },
  { id: '3', name: 'Chef', role: 'boss', password: 'chef123' }
];

// Hauptkomponente
function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'trips' | 'expenses' | 'stats' | 'cockpit'>('trips');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  
  // Modal States
  const [showTripModal, setShowTripModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  
  // Support Form State
  const [supportForm, setSupportForm] = useState({
    subject: '',
    message: ''
  });

  // Daten aus localStorage laden
  useEffect(() => {
    const savedTrips = localStorage.getItem('trips');
    const savedExpenses = localStorage.getItem('expenses');
    const savedTickets = localStorage.getItem('supportTickets');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedTrips) setTrips(JSON.parse(savedTrips));
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
    if (savedTickets) setSupportTickets(JSON.parse(savedTickets));
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  // Daten in localStorage speichern
  useEffect(() => {
    localStorage.setItem('trips', JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('supportTickets', JSON.stringify(supportTickets));
  }, [supportTickets]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Support Ticket senden
  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Sie müssen eingeloggt sein, um ein Support-Ticket zu erstellen.');
      return;
    }

    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    const newTicket: SupportTicket = {
      id: Date.now().toString(),
      subject: supportForm.subject.trim(),
      message: supportForm.message.trim(),
      driverId: currentUser.id,
      driverName: currentUser.name,
      date: new Date().toISOString(),
      status: 'open'
    };

    setSupportTickets(prev => [...prev, newTicket]);
    setSupportForm({ subject: '', message: '' });
    setShowSupportModal(false);
    
    alert('Support-Ticket wurde erfolgreich gesendet!');
  };

  // Login-Komponente
  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <h1>Fahrtenbuch - {currentUser.name}</h1>
          <div className="header-actions">
            {currentUser.role === 'driver' && (
              <button 
                className="header-btn support-btn"
                onClick={() => setShowSupportModal(true)}
              >
                Support
              </button>
            )}
            <button 
              className="logout-btn"
              onClick={() => {
                setCurrentUser(null);
                localStorage.removeItem('currentUser');
              }}
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="modal-overlay" onClick={() => setShowSupportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Support-Ticket erstellen</h2>
            <p>Beschreiben Sie Ihr Problem oder Ihre Frage. Wir werden uns schnellstmöglich bei Ihnen melden.</p>
            
            <form onSubmit={handleSupportSubmit}>
              <div className="form-group">
                <label htmlFor="subject">Betreff:</label>
                <input
                  type="text"
                  id="subject"
                  value={supportForm.subject}
                  onChange={(e) => setSupportForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Kurze Beschreibung des Problems"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="message">Nachricht:</label>
                <textarea
                  id="message"
                  value={supportForm.message}
                  onChange={(e) => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Detaillierte Beschreibung Ihres Problems oder Ihrer Frage"
                  rows={5}
                  required
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setShowSupportModal(false);
                    setSupportForm({ subject: '', message: '' });
                  }}
                >
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary">
                  Ticket senden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hauptinhalt basierend auf Benutzerrolle */}
      {currentUser.role === 'driver' ? (
        <DriverView 
          currentView={currentView}
          setCurrentView={setCurrentView}
          trips={trips}
          setTrips={setTrips}
          expenses={expenses}
          setExpenses={setExpenses}
          currentUser={currentUser}
          showTripModal={showTripModal}
          setShowTripModal={setShowTripModal}
          showExpenseModal={showExpenseModal}
          setShowExpenseModal={setShowExpenseModal}
          showArchive={showArchive}
          setShowArchive={setShowArchive}
        />
      ) : (
        <BossView 
          trips={trips}
          expenses={expenses}
          supportTickets={supportTickets}
          setSupportTickets={setSupportTickets}
        />
      )}
    </div>
  );
}

// Login-Komponente
function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const user = USERS.find(u => u.name === username && u.password === password);
    
    if (user) {
      onLogin(user);
      setError('');
    } else {
      setError('Ungültiger Benutzername oder Passwort');
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleLogin}>
        <h2>Anmelden</h2>
        <p>Melden Sie sich mit Ihren Zugangsdaten an</p>
        
        {error && <div className="auth-error">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="username">Benutzername:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Passwort:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" className="btn-primary auth-btn">
          Anmelden
        </button>
        
        <div className="auth-switch-text">
          <small>
            Testbenutzer:<br/>
            Fahrer: Max Mustermann / fahrer123<br/>
            Chef: Chef / chef123
          </small>
        </div>
      </form>
    </div>
  );
}

// Fahrer-Ansicht (vereinfacht für dieses Beispiel)
function DriverView({ currentView, setCurrentView, trips, setTrips, expenses, setExpenses, currentUser, showTripModal, setShowTripModal, showExpenseModal, setShowExpenseModal, showArchive, setShowArchive }: any) {
  return (
    <div>
      <div className="bottom-nav">
        <button 
          className={`nav-btn ${currentView === 'trips' ? 'active' : ''}`}
          onClick={() => setCurrentView('trips')}
        >
          Fahrten
        </button>
        <button 
          className={`nav-btn ${currentView === 'expenses' ? 'active' : ''}`}
          onClick={() => setCurrentView('expenses')}
        >
          Ausgaben
        </button>
        <button 
          className={`nav-btn ${currentView === 'stats' ? 'active' : ''}`}
          onClick={() => setCurrentView('stats')}
        >
          Statistik
        </button>
      </div>
      
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Fahrer-Bereich</h2>
        <p>Aktuelle Ansicht: {currentView}</p>
        <p>Hier würde der Inhalt für {currentView} angezeigt werden.</p>
      </div>
    </div>
  );
}

// Chef-Ansicht (vereinfacht für dieses Beispiel)
function BossView({ trips, expenses, supportTickets, setSupportTickets }: any) {
  return (
    <div className="boss-container">
      <h2>Chef-Bereich</h2>
      
      <div className="cockpit-section">
        <h2>Support-Tickets</h2>
        {supportTickets.length === 0 ? (
          <div className="cockpit-empty">Keine offenen Support-Tickets</div>
        ) : (
          <div className="cockpit-list">
            {supportTickets.map((ticket: SupportTicket) => (
              <div key={ticket.id} className="cockpit-item">
                <div className="cockpit-item-main">
                  <div className="cockpit-item-path">{ticket.subject}</div>
                  <div className="cockpit-item-driver">Von: {ticket.driverName}</div>
                  <div className="cockpit-item-time">
                    {new Date(ticket.date).toLocaleDateString('de-DE')}
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                    {ticket.message}
                  </div>
                </div>
                <div className={`status-badge status-${ticket.status === 'open' ? 'pending' : 'accepted'}`}>
                  {ticket.status === 'open' ? 'Offen' : 'Geschlossen'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// App starten
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}