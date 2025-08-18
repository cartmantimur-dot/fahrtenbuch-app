import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// Define the structure of a single trip
interface Trip {
  id: string;
  start: string;
  destination: string;
  payment: {
    type: 'cash' | 'invoice';
    amount: number;
  };
}

// Define the structure of a single expense
interface Expense {
  id: string;
  description: string;
  amount: number;
}


// The modal component for adding a new trip
const AddTripModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (trip: Omit<Trip, 'id'>) => void }) => {
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice'>('cash');
  const [amount, setAmount] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!start || !destination || !amount) {
      alert('Bitte alle erforderlichen Felder ausfüllen.');
      return;
    }

    onSave({
      start,
      destination,
      payment: {
        type: paymentType,
        amount: parseFloat(amount),
      },
    });
    
    // Reset form and close modal
    setStart('');
    setDestination('');
    setPaymentType('cash');
    setAmount('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Fahrt erfassen</h2>
        <form onSubmit={handleSubmit}>
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
const AddExpenseModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (expense: Omit<Expense, 'id'>) => void }) => {
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


// Main App component
const App = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'trips' | 'expenses' | 'stats'>('trips');

  // Load data from localStorage
  useEffect(() => {
    const loadData = (key: string, setter: Function) => {
        try {
            const storedData = localStorage.getItem(key);
            if (storedData) {
                setter(JSON.parse(storedData));
            }
        } catch (error) {
            console.error(`Could not load ${key} from localStorage`, error);
        }
    };
    loadData('fahrtenbuch-trips', setTrips);
    loadData('fahrtenbuch-expenses', setExpenses);
  }, []);

  // Save data to localStorage
  useEffect(() => {
    try {
        localStorage.setItem('fahrtenbuch-trips', JSON.stringify(trips));
    } catch (error) {
        console.error("Could not save trips to localStorage", error);
    }
  }, [trips]);

  useEffect(() => {
    try {
        localStorage.setItem('fahrtenbuch-expenses', JSON.stringify(expenses));
    } catch (error) {
        console.error("Could not save expenses to localStorage", error);
    }
  }, [expenses]);

  const handleAddTrip = (newTripData: Omit<Trip, 'id'>) => {
    const newTrip: Trip = {
      id: new Date().toISOString(),
      ...newTripData,
    };
    setTrips(prevTrips => [newTrip, ...prevTrips]);
  };
  
  const handleDeleteTrip = (id: string) => {
    if (window.confirm('Soll diese Fahrt wirklich gelöscht werden?')) {
        setTrips(prevTrips => prevTrips.filter(trip => trip.id !== id));
    }
  };

  const handleAddExpense = (newExpenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
        id: new Date().toISOString(),
        ...newExpenseData,
    };
    setExpenses(prevExpenses => [newExpense, ...prevExpenses]);
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Soll diese Ausgabe wirklich gelöscht werden?')) {
        setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== id));
    }
  };

  const { totalCashIncome, totalInvoiceValue, userEarnings, totalExpenses, netProfit, amountToBoss } = useMemo(() => {
    const totalCashIncome = trips
        .filter(trip => trip.payment.type === 'cash')
        .reduce((sum, trip) => sum + trip.payment.amount, 0);

    const totalInvoiceValue = trips
        .filter(trip => trip.payment.type === 'invoice')
        .reduce((sum, trip) => sum + trip.payment.amount, 0);
    
    const totalTripValue = totalCashIncome + totalInvoiceValue;
    
    const userEarnings = totalTripValue * 0.5;

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const netProfit = userEarnings - totalExpenses;
    
    const amountToBoss = totalCashIncome * 0.5;

    return { totalCashIncome, totalInvoiceValue, userEarnings, totalExpenses, netProfit, amountToBoss };
  }, [trips, expenses]);

  const renderContent = () => {
    switch (activeView) {
        case 'trips':
            return (
                <>
                    {trips.length === 0 ? (
                        <div className="empty-state">
                            <h2>Willkommen!</h2>
                            <p>Noch keine Fahrten erfasst. Fügen Sie Ihre erste Fahrt über das '+' Symbol hinzu.</p>
                        </div>
                    ) : (
                        <div className="list-container">
                            {trips.map(trip => (
                                <div key={trip.id} className="trip-card">
                                    <div className="card-header">
                                        <div className="card-path">
                                            <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                        </div>
                                        <button onClick={() => handleDeleteTrip(trip.id)} className="delete-btn" aria-label="Fahrt löschen">
                                            &times;
                                        </button>
                                    </div>
                                    <div className={`card-payment ${trip.payment.type}`}>
                                        {trip.payment.type === 'cash'
                                        ? `Bar erhalten: ${trip.payment.amount.toFixed(2)} €`
                                        : `Per Rechnung: ${trip.payment.amount.toFixed(2)} €`}
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
                                <div key={expense.id} className="expense-card">
                                    <div className="card-header">
                                        <span>{expense.description}</span>
                                        <button onClick={() => handleDeleteExpense(expense.id)} className="delete-btn" aria-label="Ausgabe löschen">
                                            &times;
                                        </button>
                                    </div>
                                    <div className="expense-amount">
                                        {expense.amount.toFixed(2)} €
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
                    <div className="stat-card">
                        <h3>Einnahmen (Bar)</h3>
                        <p className="amount positive">{totalCashIncome.toFixed(2)} €</p>
                    </div>
                     <div className="stat-card">
                        <h3>Wert (Rechnung)</h3>
                        <p className="amount invoice">{totalInvoiceValue.toFixed(2)} €</p>
                    </div>
                    <div className="stat-card">
                        <h3>Ausgaben</h3>
                        <p className="amount negative">{totalExpenses.toFixed(2)} €</p>
                    </div>
                    <div className="stat-card">
                        <h3>An den Chef abzugeben</h3>
                        <p className="amount boss">{amountToBoss.toFixed(2)} €</p>
                    </div>
                    <div className={`stat-card large ${netProfit >= 0 ? 'profit' : 'loss'}`}>
                        <h3>Mein Verdienst</h3>
                        <p className="amount">{netProfit.toFixed(2)} €</p>
                    </div>
                </div>
            )
    }
  }


  return (
    <>
        <header>
            <h1>Fahrtenbuch</h1>
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
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}