
import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

const LICENSE_PLATES = [
  "BM-PP 299",
  "BM-LL 3016",
  "BM-MD 2011",
  "BM-AV 2024",
  "Leihwagen 1",
  "Leihwagen 2",
  "Test Wagen"
];

// WICHTIG: Ersetzen Sie diesen Platzhalter durch Ihre Google Apps Script URL.
const GOOGLE_SHEET_URL: string = 'https://script.google.com/macros/s/AKfycbwnvIj19oSB-UY_dZ2_EbSsg_7G7O6LH-UFfhs7_bDB5Fsq35-jFpdxsG7oCqdoHzolvg/exec';

// Define the structure of a single trip
interface Trip {
  id: string;
  licensePlate: string;
  start: string;
  destination: string;
  payment: {
    type: 'cash' | 'invoice';
    amount: number;
  };
  numberOfDrivers: number;
  iCollectedPayment: boolean;
  isSettled: boolean;
  notes?: string;
}

// Define the structure of a single expense
interface Expense {
  id: string;
  description: string;
  amount: number;
  isReimbursed: boolean;
}

// The modal component for adding a new trip
const AddTripModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (trip: Omit<Trip, 'id' | 'isSettled'>) => void }) => {
  const [licensePlate, setLicensePlate] = useState('');
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice'>('cash');
  const [amount, setAmount] = useState('');
  const [numberOfDrivers, setNumberOfDrivers] = useState('1');
  const [iCollectedPayment, setICollectedPayment] = useState(true);
  const [notes, setNotes] = useState('');


  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!licensePlate || !start || !destination || !amount || !numberOfDrivers) {
      alert('Bitte alle erforderlichen Felder ausfüllen.');
      return;
    }

    onSave({
      licensePlate,
      start,
      destination,
      payment: {
        type: paymentType,
        amount: parseFloat(amount),
      },
      numberOfDrivers: parseInt(numberOfDrivers, 10),
      iCollectedPayment: parseInt(numberOfDrivers, 10) === 1 ? true : iCollectedPayment,
      notes,
    });
    
    // Reset form and close modal
    setLicensePlate('');
    setStart('');
    setDestination('');
    setPaymentType('cash');
    setAmount('');
    setNumberOfDrivers('1');
    setICollectedPayment(true);
    setNotes('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Fahrt erfassen</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="license-plate">Kennzeichen</label>
            <select
              id="license-plate"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              required
            >
              <option value="" disabled>Bitte auswählen...</option>
              {LICENSE_PLATES.map(lp => (
                <option key={lp} value={lp}>{lp}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="start">Start</label>
            <input
              type="text"
              id="start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="destination">Ziel</label>
            <input
              type="text"
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
            />
          </div>
           <div className="form-group">
            <label htmlFor="amount">Betrag (€)</label>
            <input
              type="number"
              id="amount"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Bezahlung</label>
            <div className="radio-group">
                <label>
                    <input
                    type="radio"
                    name="paymentType"
                    value="cash"
                    checked={paymentType === 'cash'}
                    onChange={() => setPaymentType('cash')}
                    />
                    Bar bezahlt
                </label>
                <label>
                    <input
                    type="radio"
                    name="paymentType"
                    value="invoice"
                    checked={paymentType === 'invoice'}
                    onChange={() => setPaymentType('invoice')}
                    />
                    Rechnung
                </label>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="num-drivers">Beteiligte Fahrer</label>
            <input
              type="number"
              id="num-drivers"
              min="1"
              step="1"
              value={numberOfDrivers}
              onChange={(e) => setNumberOfDrivers(e.target.value)}
              required
            />
          </div>

          {parseInt(numberOfDrivers, 10) > 1 && (
            <div className="form-group">
              <div className="checkbox-group">
                  <label>
                      <input
                      type="checkbox"
                      checked={iCollectedPayment}
                      onChange={(e) => setICollectedPayment(e.target.checked)}
                      />
                      Ich habe den Gesamtbetrag kassiert
                  </label>
              </div>
               <p className="form-hint">
                Für eine Hin- und Rückfahrt mit zwei Fahrern: Tragen Sie 2 Fahrer und den Gesamtbetrag ein. Nur der Fahrer, der das Geld erhalten hat, markiert diese Box.
              </p>
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="notes">Notiz (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="z.B. Hin- & Rückfahrt für Gast Meier"
            ></textarea>
          </div>
         
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// The modal component for adding a new expense
const AddExpenseModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (expense: Omit<Expense, 'id' | 'isReimbursed'>) => void }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!description || !amount) {
            alert('Bitte alle Felder ausfüllen.');
            return;
        }

        onSave({
            description,
            amount: parseFloat(amount),
        });

        setDescription('');
        setAmount('');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Ausgabe erfassen</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="description">Beschreibung</label>
                        <input
                            type="text"
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="z.B. Tanken, Ticket"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="expense-amount">Betrag (€)</label>
                        <input
                            type="number"
                            id="expense-amount"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Abbrechen
                        </button>
                        <button type="submit" className="btn-primary">
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmButtonText = 'Bestätigen', isDestructive = false }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  isDestructive?: boolean;
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className={isDestructive ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};


// Main App component
const App = ({ username, onLogout }: { username: string, onLogout: () => void }) => {
  const TRIPS_KEY = `fahrtenbuch-trips-${username}`;
  const EXPENSES_KEY = `fahrtenbuch-expenses-${username}`;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'trips' | 'expenses' | 'stats'>('trips');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalProps, setConfirmModalProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmButtonText: 'OK',
    isDestructive: false,
  });

  // Load data from localStorage
  useEffect(() => {
    try {
        const storedTrips = localStorage.getItem(TRIPS_KEY);
        if (storedTrips) {
            const parsedTrips = JSON.parse(storedTrips);
            const safeTrips = parsedTrips.map((trip: any) => ({
                ...trip,
                numberOfDrivers: trip.numberOfDrivers || 1,
                iCollectedPayment: trip.iCollectedPayment === undefined ? true : trip.iCollectedPayment,
                isSettled: trip.isSettled || false,
                notes: trip.notes || '',
            }));
            setTrips(safeTrips);
        }
        const storedExpenses = localStorage.getItem(EXPENSES_KEY);
        if (storedExpenses) {
             const parsedExpenses = JSON.parse(storedExpenses);
             const safeExpenses = parsedExpenses.map((expense: any) => ({
                ...expense,
                isReimbursed: expense.isReimbursed || false,
            }));
            setExpenses(safeExpenses);
        }
    } catch (error) {
        console.error(`Could not load data from localStorage`, error);
    }
  }, [username, TRIPS_KEY, EXPENSES_KEY]);

  // Save data to localStorage
  useEffect(() => {
    try {
        localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    } catch (error) {
        console.error("Could not save trips to localStorage", error);
    }
  }, [trips, TRIPS_KEY]);

  useEffect(() => {
    try {
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    } catch (error) {
        console.error("Could not save expenses to localStorage", error);
    }
  }, [expenses, EXPENSES_KEY]);

  // Syncs a single trip to the configured Google Sheet URL
  const syncTrip = async (trip: Trip) => {
    if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL === 'IHRE_GOOGLE_APPS_SCRIPT_URL_HIER_EINFUEGEN') {
      console.warn("Google Sheet URL ist nicht konfiguriert. Synchronisierung übersprungen.");
      return;
    }
    
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ dataType: 'trip', ...trip, username }),
      });
    } catch (error) {
      console.error("Failed to sync trip to Google Sheet:", error);
      alert(`Synchronisierung für Fahrt ${trip.id} fehlgeschlagen.`);
    }
  };

  const syncExpense = async (expense: Expense) => {
    if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL === 'IHRE_GOOGLE_APPS_SCRIPT_URL_HIER_EINFUEGEN') {
      console.warn("Google Sheet URL ist nicht konfiguriert. Synchronisierung übersprungen.");
      return;
    }
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ dataType: 'expense', ...expense, username }),
      });
    } catch (error) {
      console.error("Failed to sync expense to Google Sheet:", error);
      alert(`Synchronisierung für Ausgabe ${expense.id} fehlgeschlagen.`);
    }
  };


  const handleAddTrip = (newTripData: Omit<Trip, 'id' | 'isSettled'>) => {
    const newTrip: Trip = {
      id: new Date().toISOString() + Math.random().toString(36).substr(2, 9),
      ...newTripData,
      isSettled: false,
    };
    setTrips(prevTrips => [newTrip, ...prevTrips]);
    syncTrip(newTrip);
  };
  
  const handleDeleteTrip = (id: string) => {
    setConfirmModalProps({
        title: 'Fahrt löschen',
        message: 'Soll diese Fahrt wirklich endgültig gelöscht werden?',
        onConfirm: () => {
            setTrips(prevTrips => prevTrips.filter(trip => trip.id !== id));
            setIsConfirmModalOpen(false);
        },
        confirmButtonText: 'Löschen',
        isDestructive: true,
    });
    setIsConfirmModalOpen(true);
  };

  const handleSettleTrip = (id: string) => {
    let settledTrip: Trip | undefined;
    const updatedTrips = trips.map(trip => {
        if (trip.id === id) {
            settledTrip = { ...trip, isSettled: true };
            return settledTrip;
        }
        return trip;
    });
    setTrips(updatedTrips);
    if (settledTrip) {
        syncTrip(settledTrip);
    }
  };

  const handleAddExpense = (newExpenseData: Omit<Expense, 'id' | 'isReimbursed'>) => {
    const newExpense: Expense = {
        id: new Date().toISOString() + Math.random().toString(36).substr(2, 9),
        ...newExpenseData,
        isReimbursed: false,
    };
    setExpenses(prevExpenses => [newExpense, ...prevExpenses]);
    syncExpense(newExpense);
  };

  const handleReimburseExpense = (id: string) => {
    let reimbursedExpense: Expense | undefined;
    const updatedExpenses = expenses.map(expense => {
        if (expense.id === id) {
            reimbursedExpense = { ...expense, isReimbursed: true };
            return reimbursedExpense;
        }
        return expense;
    });
    setExpenses(updatedExpenses);
    if (reimbursedExpense) {
        syncExpense(reimbursedExpense);
    }
  };

  const handleDeleteExpense = (id: string) => {
    setConfirmModalProps({
        title: 'Ausgabe löschen',
        message: 'Soll diese Ausgabe wirklich endgültig gelöscht werden?',
        onConfirm: () => {
            setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== id));
            setIsConfirmModalOpen(false);
        },
        confirmButtonText: 'Löschen',
        isDestructive: true,
    });
    setIsConfirmModalOpen(true);
  };

  const handleSettleAll = () => {
    setConfirmModalProps({
      title: 'Alles abrechnen',
      message: 'Möchten Sie wirklich alle offenen Fahrten und Ausgaben als abgerechnet markieren?',
      onConfirm: () => {
        const newlySettledTrips: Trip[] = [];
        const updatedTrips = trips.map(trip => {
            if (!trip.isSettled) {
                const settledTrip = { ...trip, isSettled: true };
                newlySettledTrips.push(settledTrip);
                return settledTrip;
            }
            return trip;
        });

        const newlyReimbursedExpenses: Expense[] = [];
        const updatedExpenses = expenses.map(expense => {
            if (!expense.isReimbursed) {
                const reimbursedExpense = { ...expense, isReimbursed: true };
                newlyReimbursedExpenses.push(reimbursedExpense);
                return reimbursedExpense;
            }
            return expense;
        });

        setTrips(updatedTrips);
        setExpenses(updatedExpenses);

        // Sync all changes
        newlySettledTrips.forEach(syncTrip);
        newlyReimbursedExpenses.forEach(syncExpense);
        setIsConfirmModalOpen(false);
      },
      confirmButtonText: 'Ja, alles abrechnen',
      isDestructive: false,
    });
    setIsConfirmModalOpen(true);
  };

  const { openCashCollected, openInvoiceIssued, openExpenses, openMyEarnings, amountToBoss } = useMemo(() => {
    // Filter for only unsettled/unreimbursed items
    const unsettledTrips = trips.filter(trip => !trip.isSettled);
    const unreimbursedExpenses = expenses.filter(expense => !expense.isReimbursed);

    const openCashCollected = unsettledTrips
        .filter(trip => trip.payment.type === 'cash' && trip.iCollectedPayment)
        .reduce((sum, trip) => sum + trip.payment.amount, 0);

    const openInvoiceIssued = unsettledTrips
        .filter(trip => trip.payment.type === 'invoice' && trip.iCollectedPayment)
        .reduce((sum, trip) => sum + trip.payment.amount, 0);
    
    const openUserShare = unsettledTrips
        .reduce((sum, trip) => sum + (trip.payment.amount * 0.5) / trip.numberOfDrivers, 0);

    const openExpenses = unreimbursedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    const openMyEarnings = openUserShare;
    
    const amountToBoss = openCashCollected - openUserShare - openExpenses;

    return { openCashCollected, openInvoiceIssued, openExpenses, openMyEarnings, amountToBoss };
  }, [trips, expenses]);

  const renderContent = () => {
    switch (activeView) {
        case 'trips':
            return (
                <>
                    {trips.length === 0 ? (
                        <div className="empty-state">
                            <h2>Willkommen, {username}!</h2>
                            <p>Noch keine Fahrten erfasst. Fügen Sie Ihre erste Fahrt über das '+' Symbol hinzu.</p>
                        </div>
                    ) : (
                        <div className="list-container">
                            {trips.map(trip => (
                                <div key={trip.id} className={`trip-card ${trip.isSettled ? 'settled' : ''}`}>
                                    <div className="card-header">
                                        <div className="card-path">
                                            <span className="license-plate-badge">{trip.licensePlate}</span>
                                            <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                        </div>
                                        <button onClick={() => handleDeleteTrip(trip.id)} className="delete-btn" aria-label="Fahrt löschen">
                                            &times;
                                        </button>
                                    </div>
                                    <div className="card-details">
                                        {trip.numberOfDrivers > 1 && (
                                            <span className="detail-badge">
                                                Gruppenfahrt ({trip.numberOfDrivers} Fahrer)
                                            </span>
                                        )}
                                        <span className="detail-badge">
                                            {trip.iCollectedPayment ? 'Bezahlung erhalten' : 'Bezahlung durch Kollegen'}
                                        </span>
                                    </div>
                                    {trip.notes && (
                                      <div className="card-notes">
                                        <p>{trip.notes}</p>
                                      </div>
                                    )}
                                    <div className={`card-payment ${trip.payment.type}`}>
                                        {trip.payment.type === 'cash'
                                        ? `Bar erhalten: ${trip.payment.amount.toFixed(2)} €`
                                        : `Per Rechnung: ${trip.payment.amount.toFixed(2)} €`}
                                    </div>
                                    <div className="card-actions">
                                      <button 
                                        onClick={() => handleSettleTrip(trip.id)} 
                                        disabled={trip.isSettled} 
                                        className="settle-btn"
                                      >
                                        {trip.isSettled ? 'Abgerechnet ✔' : 'Mit Chef abrechnen'}
                                      </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="add-fab" onClick={() => setIsTripModalOpen(true)} aria-label="Fahrt hinzufügen">
                        +
                    </button>
                </>
            );
        case 'expenses':
            return (
                <>
                    {expenses.length === 0 ? (
                         <div className="empty-state">
                            <h2>Keine Ausgaben</h2>
                            <p>Fügen Sie Ihre erste Ausgabe über das '+' Symbol hinzu.</p>
                        </div>
                    ) : (
                        <div className="list-container">
                            {expenses.map(expense => (
                                <div key={expense.id} className={`expense-card ${expense.isReimbursed ? 'reimbursed' : ''}`}>
                                    <div className="card-header">
                                        <span>{expense.description}</span>
                                        <button onClick={() => handleDeleteExpense(expense.id)} className="delete-btn" aria-label="Ausgabe löschen">
                                            &times;
                                        </button>
                                    </div>
                                    <div className="expense-amount">
                                        {expense.amount.toFixed(2)} €
                                    </div>
                                    <div className="card-actions">
                                      <button 
                                        onClick={() => handleReimburseExpense(expense.id)} 
                                        disabled={expense.isReimbursed} 
                                        className="reimburse-btn"
                                      >
                                        {expense.isReimbursed ? 'Erstattet ✔' : 'Vom Chef erstatten'}
                                      </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="add-fab" onClick={() => setIsExpenseModalOpen(true)} aria-label="Ausgabe hinzufügen">
                        +
                    </button>
                </>
            );
        case 'stats':
            return (
                <div className="stats-grid">
                    <div className="stat-card large settle-all-card">
                        <h3>Offene Posten abrechnen</h3>
                        <p>Markiert alle Fahrten als abgerechnet und alle Ausgaben als erstattet.</p>
                        <button type="button" className="btn-primary settle-all-btn" onClick={handleSettleAll}>
                            Alles abrechnen
                        </button>
                    </div>
                    <div className="stat-card">
                        <h3>Offene Bareinnahmen</h3>
                        <p className="amount positive">{openCashCollected.toFixed(2)} €</p>
                    </div>
                     <div className="stat-card">
                        <h3>Offene Rechnungen</h3>
                        <p className="amount invoice">{openInvoiceIssued.toFixed(2)} €</p>
                    </div>
                    <div className="stat-card">
                        <h3>Offene Ausgaben</h3>
                        <p className="amount negative">{openExpenses.toFixed(2)} €</p>
                    </div>
                    <div className="stat-card">
                        <h3>An Chef zu zahlen</h3>
                        <p className={`amount boss ${amountToBoss < 0 ? 'negative' : ''}`}>{amountToBoss.toFixed(2)} €</p>
                    </div>
                    <div className={`stat-card large profit`}>
                        <h3>Mein offener Verdienst</h3>
                        <p className="amount">{openMyEarnings.toFixed(2)} €</p>
                    </div>
                </div>
            )
    }
  }


  return (
    <>
        <header>
            <div className="header-content">
                <h1>Fahrtenbuch</h1>
                <button className="logout-btn" onClick={onLogout}>Logout</button>
            </div>
        </header>
        <main className="app-container">
            {renderContent()}
        </main>
      
        <nav className="bottom-nav">
            <button className={`nav-btn ${activeView === 'trips' ? 'active' : ''}`} onClick={() => setActiveView('trips')}>Fahrten</button>
            <button className={`nav-btn ${activeView === 'expenses' ? 'active' : ''}`} onClick={() => setActiveView('expenses')}>Ausgaben</button>
            <button className={`nav-btn ${activeView === 'stats' ? 'active' : ''}`} onClick={() => setActiveView('stats')}>Statistik</button>
        </nav>

        <AddTripModal
            isOpen={isTripModalOpen}
            onClose={() => setIsTripModalOpen(false)}
            onSave={handleAddTrip}
        />
        <AddExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => setIsExpenseModalOpen(false)}
            onSave={handleAddExpense}
        />
        <ConfirmModal 
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            {...confirmModalProps}
        />
    </>
  );
};

// --- AUTHENTICATION COMPONENTS ---

const LoginScreen = ({ onLogin, storedUser }: { onLogin: (username: string) => void, storedUser: { username: string, password: string } }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (username === storedUser.username && password === storedUser.password) {
            onLogin(username);
        } else {
            setError('Benutzername oder Passwort ist falsch.');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Anmelden</h2>
                <p>Willkommen zurück!</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="login-username">Benutzername</label>
                        <input
                            type="text"
                            id="login-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="login-password">Passwort</label>
                        <input
                            type="password"
                            id="login-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="btn-primary auth-btn">Anmelden</button>
                </form>
            </div>
        </div>
    );
};

const RegistrationScreen = ({ onRegister }: { onRegister: (username: string) => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            alert('Bitte Benutzername und Passwort eingeben.');
            return;
        }
        // Save user data to localStorage. In a real app, this would be a secure server call.
        localStorage.setItem('fahrtenbuch-user', JSON.stringify({ username, password }));
        onRegister(username);
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Registrieren</h2>
                <p>Erstelle ein Konto, um deine Fahrten zu speichern.</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="reg-username">Benutzername</label>
                        <input
                            type="text"
                            id="reg-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-password">Passwort</label>
                        <input
                            type="password"
                            id="reg-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary auth-btn">Konto erstellen</button>
                </form>
            </div>
        </div>
    );
};

// A wrapper component to handle the authentication state
const AppContainer = () => {
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [storedUser, setStoredUser] = useState<{username: string, password: string} | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const userJson = localStorage.getItem('fahrtenbuch-user');
            if (userJson) {
                setStoredUser(JSON.parse(userJson));
            }
        } catch (error) {
            console.error("Could not load user from localStorage", error);
        }
        setIsLoading(false);
    }, []);

    const handleLogin = (username: string) => {
        setCurrentUser(username);
    };

    const handleRegister = (username: string) => {
        // After registration, we need to update the storedUser state to switch to the login view or directly log them in.
        // For simplicity, we'll log them in directly.
        setCurrentUser(username);
    };

    const handleLogout = () => {
        setCurrentUser(null);
    };

    if (isLoading) {
        return null; // or a loading spinner
    }

    if (currentUser) {
        return <App username={currentUser} onLogout={handleLogout} />;
    }

    if (storedUser) {
        return <LoginScreen onLogin={handleLogin} storedUser={storedUser} />;
    }

    return <RegistrationScreen onRegister={handleRegister} />;
};


const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AppContainer />);
}
