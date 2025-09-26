import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const LICENSE_PLATES = [
  "BM-PP 299",
  "BM-LL 3016",
  "BM-MD 2011",
  "BM-AV 2024",
  "Leihwagen 1",
  "Leihwagen 2",
  "Test Wagen"
];

const GOOGLE_SHEET_URL: string = 'https://script.google.com/macros/s/AKfycbwnvIj19oSB-UY_dZ2_EbSsg_7G7O6LH-UFfhs7_bDB5Fsq35-jFpdxsG7oCqdoHzolvg/exec';

// WICHTIG: Ersetzen Sie die folgende Nummer durch Ihre echte WhatsApp-Nummer im internationalen Format (z.B. 491761234567 für Deutschland).
// Keine Nullen am Anfang, kein '+' oder sonstige Zeichen.
const CHEF_WHATSAPP_NUMBER = '4915786079715'; 

// --- INTERFACES ---
interface Trip {
  id: string;
  username?: string;
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

interface Expense {
  id: string;
  username?: string;
  description: string;
  amount: number;
  isReimbursed: boolean;
}

interface AssignedTrip {
    id: string;
    driver?: string; // For boss cockpit view
    start: string;
    destination: string;
    amount: number;
    notes: string;
    pickupTime: string; // ISO String
    status: 'pending' | 'accepted' | 'declined';
}

interface Address {
    street: string;
    plz: string;
}

// --- NEW CUSTOMER BOOKING FORM ---
const CustomerBookingForm = () => {
    const COLOGNE_AIRPORT = { street: 'Flughafen Köln/Bonn (CGN)', plz: '51147' };
    const DUSSELDORF_AIRPORT = { street: 'Flughafen Düsseldorf (DUS)', plz: '40474' };

    const [pickupLocations, setPickupLocations] = useState<Address[]>([{ street: '', plz: '' }]);
    const [destination, setDestination] = useState<Address>({ street: '', plz: '' });
    const [isAirportPickup, setIsAirportPickup] = useState(false);
    const [flightNumber, setFlightNumber] = useState('');
    const [pickupDate, setPickupDate] = useState('');
    const [pickupTime, setPickupTime] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [passengerCount, setPassengerCount] = useState('1');
    const [errorMessage, setErrorMessage] = useState('');
    
    const handlePickupLocationChange = (index: number, field: keyof Address, value: string) => {
        const newLocations = [...pickupLocations];
        newLocations[index][field] = value;
        setPickupLocations(newLocations);
    };

    const handleDestinationChange = (field: keyof Address, value: string) => {
        setDestination(prev => ({ ...prev, [field]: value }));
    };

    const addPickupLocation = () => {
        setPickupLocations([...pickupLocations, { street: '', plz: '' }]);
    };
    
    const removePickupLocation = (index: number) => {
        if (pickupLocations.length > 1) {
            setPickupLocations(pickupLocations.filter((_, i) => i !== index));
        }
    };
    
    const setPickupAsAirport = (airport: Address) => {
        const newLocations = [...pickupLocations];
        newLocations[0] = airport; 
        setPickupLocations(newLocations);
        setIsAirportPickup(true);
    };

    const setDestinationAsAirport = (airport: Address) => {
        setDestination(airport);
    };


    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const arePickupsInvalid = pickupLocations.some(loc => !loc.street || !loc.plz);
        if (!customerName || !customerPhone || !passengerCount || !destination.street || !destination.plz || !pickupDate || !pickupTime || arePickupsInvalid) {
            setErrorMessage('Bitte füllen Sie alle erforderlichen Felder aus (inkl. PLZ).');
            return;
        }
        if (isAirportPickup && !flightNumber) {
            setErrorMessage('Bitte geben Sie die Flugnummer an.');
            return;
        }
        setErrorMessage('');

        const pickupLocationsString = pickupLocations
            .map(loc => `- ${loc.street}, ${loc.plz}`)
            .join('\n');

        const destinationString = `${destination.street}, ${destination.plz}`;
        
        const formattedDate = new Date(pickupDate).toLocaleDateString('de-DE', {
            weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
        });

        let message = `*Neue Fahrtanfrage*\n\n`;
        message += `*Kunde:* ${customerName}\n`;
        message += `*Telefon:* ${customerPhone}\n`;
        message += `*Anzahl Personen:* ${passengerCount}\n\n`;
        message += `*Abholung:*\n${pickupLocationsString}\n\n`;
        message += `*Ziel:* ${destinationString}\n\n`;
        message += `*Zeit:* ${formattedDate} um ${pickupTime} Uhr\n`;

        if (isAirportPickup && flightNumber) {
            message += `*Flugnummer:* ${flightNumber}\n`;
        }
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${CHEF_WHATSAPP_NUMBER}?text=${encodedMessage}`;
        
        window.location.href = whatsappUrl;
    };
    
    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Fahrt anfragen</h2>
                <p>Nach dem Ausfüllen werden Sie zu WhatsApp weitergeleitet, um die Anfrage zu senden.</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="customerName">Ihr Name</label>
                        <input type="text" id="customerName" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="customerPhone">Ihre Telefonnummer</label>
                        <input type="tel" id="customerPhone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="passengerCount">Anzahl der Fahrgäste</label>
                        <input type="number" id="passengerCount" value={passengerCount} min="1" onChange={e => setPassengerCount(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Abholort(e)</label>
                        <div className="airport-buttons">
                            <button type="button" onClick={() => setPickupAsAirport(COLOGNE_AIRPORT)}>✈️ Köln/Bonn</button>
                            <button type="button" onClick={() => setPickupAsAirport(DUSSELDORF_AIRPORT)}>✈️ Düsseldorf</button>
                        </div>
                        {pickupLocations.map((location, index) => (
                           <div key={index} className="pickup-location-group">
                                <div className="address-group">
                                    <div className="form-group">
                                        <label htmlFor={`pickup-street-${index}`} className="sr-only">Straße &amp; Hausnummer</label>
                                        <input 
                                            type="text" 
                                            id={`pickup-street-${index}`}
                                            value={location.street}
                                            onChange={e => handlePickupLocationChange(index, 'street', e.target.value)}
                                            placeholder={index === 0 ? "Haupt-Abholadresse" : "Weitere Adresse"}
                                            required
                                        />
                                    </div>
                                    <div className="form-group plz-group">
                                        <label htmlFor={`pickup-plz-${index}`} className="sr-only">PLZ</label>
                                        <input
                                            type="text"
                                            id={`pickup-plz-${index}`}
                                            value={location.plz}
                                            onChange={e => handlePickupLocationChange(index, 'plz', e.target.value)}
                                            placeholder="PLZ"
                                            required
                                            pattern="\d{4,5}"
                                            title="Bitte geben Sie eine gültige PLZ ein."
                                        />
                                    </div>
                                </div>
                                {pickupLocations.length > 1 && (
                                    <button type="button" className="remove-location-btn" onClick={() => removePickupLocation(index)} aria-label="Adresse entfernen">&times;</button>
                                )}
                           </div>
                        ))}
                        <button type="button" className="add-location-btn" onClick={addPickupLocation}>+ Weitere Adresse hinzufügen</button>
                    </div>
                     <div className="form-group">
                        <label htmlFor="destination-street">Zielort</label>
                         <div className="airport-buttons">
                            <button type="button" onClick={() => setDestinationAsAirport(COLOGNE_AIRPORT)}>✈️ Köln/Bonn</button>
                            <button type="button" onClick={() => setDestinationAsAirport(DUSSELDORF_AIRPORT)}>✈️ Düsseldorf</button>
                        </div>
                         <div className="address-group">
                            <div className="form-group">
                               <label htmlFor="destination-street" className="sr-only">Straße &amp; Hausnummer</label>
                                <input 
                                    type="text" 
                                    id="destination-street"
                                    value={destination.street} 
                                    onChange={e => handleDestinationChange('street', e.target.value)} 
                                    required 
                                    placeholder="Straße & Hausnummer"
                                />
                            </div>
                            <div className="form-group plz-group">
                                <label htmlFor="destination-plz" className="sr-only">PLZ</label>
                                <input
                                    type="text"
                                    id="destination-plz"
                                    value={destination.plz}
                                    onChange={e => handleDestinationChange('plz', e.target.value)}
                                    placeholder="PLZ"
                                    required
                                    pattern="\d{4,5}"
                                    title="Bitte geben Sie eine gültige PLZ ein."
                                />
                            </div>
                         </div>
                    </div>
                    <div className="form-group">
                        <div className="checkbox-group">
                             <label>
                                <input type="checkbox" checked={isAirportPickup} onChange={e => setIsAirportPickup(e.target.checked)} />
                                Abholung vom Flughafen?
                            </label>
                        </div>
                    </div>
                    {isAirportPickup && (
                         <div className="form-group">
                            <label htmlFor="flightNumber">Flugnummer</label>
                            <input type="text" id="flightNumber" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} required placeholder="z.B. EW123" />
                        </div>
                    )}
                    <div className="datetime-group">
                        <div className="form-group">
                            <label htmlFor="pickupDate">Datum</label>
                            <input type="date" id="pickupDate" value={pickupDate} onChange={e => setPickupDate(e.target.value)} required />
                        </div>
                         <div className="form-group">
                            <label htmlFor="pickupTime">Uhrzeit</label>
                            <input type="time" id="pickupTime" value={pickupTime} onChange={e => setPickupTime(e.target.value)} required />
                        </div>
                    </div>
                     <div className="midnight-warning">
                        <strong>Wichtiger Hinweis:</strong> Eine Fahrt um 00:00 Uhr am 29. Juli findet in der Nacht vom 28. auf den 29. Juli statt. Wenn Sie am Ende des 29. Juli fahren möchten, wählen Sie bitte den 30. Juli, 00:00 Uhr.
                    </div>

                    {errorMessage && <p className="auth-error">{errorMessage}</p>}
                    <button type="submit" className="btn-primary auth-btn">
                        Anfrage per WhatsApp senden
                    </button>
                </form>
            </div>
        </div>
    );
};


// The modal component for adding a new trip
const AddTripModal = ({ isOpen, onClose, onSave, initialData }: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (trip: Omit<Trip, 'id' | 'isSettled' | 'username'>) => void,
    initialData?: Partial<AssignedTrip> 
}) => {
  const [licensePlate, setLicensePlate] = useState('');
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice'>('cash');
  const [amount, setAmount] = useState('');
  const [numberOfDrivers, setNumberOfDrivers] = useState('1');
  const [iCollectedPayment, setICollectedPayment] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
        setStart(initialData.start || '');
        setDestination(initialData.destination || '');
        setAmount(initialData.amount ? String(initialData.amount) : '');
        setNotes(initialData.notes || '');
    }
  }, [initialData]);


  if (!isOpen) {
    return null;
  }
  
  const resetAndClose = () => {
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
    
    resetAndClose();
  };

  return (
    <div className="modal-overlay" onClick={resetAndClose}>
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
            <button type="button" className="btn-secondary" onClick={resetAndClose}>
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
const AddExpenseModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (expense: Omit<Expense, 'id' | 'isReimbursed' | 'username'>) => void }) => {
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

const SupportModal = ({ isOpen, onClose, onSubmit, openTrips }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (message: string, attachedTripId: string | null) => void;
    openTrips: Trip[];
}) => {
    const [message, setMessage] = useState('');
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            alert('Bitte beschreiben Sie Ihr Anliegen.');
            return;
        }
        onSubmit(message, selectedTripId);
        setMessage('');
        setSelectedTripId(null);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Support kontaktieren</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="support-message">Ihre Nachricht</label>
                        <textarea
                            id="support-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                            placeholder="Bitte beschreiben Sie hier Ihr Problem oder Ihre Frage..."
                            required
                        ></textarea>
                    </div>

                    {openTrips.length > 0 && (
                        <div className="form-group">
                            <label>Problem mit einer Fahrt verknüpfen (optional)</label>
                            <div className="support-trip-list">
                                {openTrips.map(trip => (
                                    <label key={trip.id} className="support-trip-item">
                                        <input
                                            type="radio"
                                            name="support-trip"
                                            value={trip.id}
                                            checked={selectedTripId === trip.id}
                                            onChange={() => setSelectedTripId(trip.id)}
                                        />
                                        <div className="trip-details-container">
                                            <span>{trip.start} → {trip.destination}</span>
                                            <span className="amount">{trip.payment.amount.toFixed(2)} €</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Abbrechen</button>
                        <button type="submit" className="btn-primary">Ticket senden</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const formatMonth = (key: string) => {
    const [year, monthNum] = key.split('-');
    const monthIndex = parseInt(monthNum, 10) - 1;

    if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11 || isNaN(parseInt(year, 10))) {
        console.error("Invalid month key provided to formatMonth:", key);
        return 'Ungültiger Zeitraum';
    }

    const monthNames = [
        "Januar", "Februar", "März", "April", "Mai", "Juni", 
        "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];

    return `${monthNames[monthIndex]} ${year}`;
};

const ArchiveView = ({ trips, expenses, onClose }: { trips: Trip[], expenses: Expense[], onClose: () => void }) => {
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

    const archiveData = useMemo(() => {
        const settledTrips = trips.filter(t => t.isSettled);
        const reimbursedExpenses = expenses.filter(e => e.isReimbursed);

        const allItems = [...settledTrips, ...reimbursedExpenses];

        const grouped = allItems.reduce((acc, item) => {
            const dateString = item.id.substring(0, 24);
            const date = new Date(dateString);

            if (isNaN(date.getTime())) {
                console.warn('Skipping item with invalid date in ID:', item);
                return acc;
            }
            
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!acc[monthKey]) {
                acc[monthKey] = { trips: [], expenses: [], totalEarnings: 0 };
            }

            if ('licensePlate' in item) { // It's a Trip
                acc[monthKey].trips.push(item);
                acc[monthKey].totalEarnings += (item.payment.amount * 0.5) / item.numberOfDrivers;
            } else { // It's an Expense
                acc[monthKey].expenses.push(item);
            }
            
            return acc;
        }, {} as Record<string, { trips: Trip[], expenses: Expense[], totalEarnings: number }>);

        Object.values(grouped).forEach(monthData => {
            const getDateFromItem = (item: Trip | Expense) => new Date(item.id.substring(0, 24)).getTime();
            monthData.trips.sort((a, b) => getDateFromItem(b) - getDateFromItem(a));
            monthData.expenses.sort((a, b) => getDateFromItem(b) - getDateFromItem(a));
        });

        return grouped;
    }, [trips, expenses]);
    
    const sortedMonthKeys = useMemo(() => Object.keys(archiveData).sort().reverse(), [archiveData]);
    
    if (selectedMonthKey && archiveData[selectedMonthKey]) {
      const monthData = archiveData[selectedMonthKey];
      return (
        <div className="archive-overlay">
          <header className="archive-header">
            <button className="header-btn" onClick={() => setSelectedMonthKey(null)}>Zurück</button>
            <h2>{formatMonth(selectedMonthKey)}</h2>
            <div style={{width: '50px'}}></div> {/* Spacer */}
          </header>
          <div className="archive-content">
            <div className="archive-summary-card">
              <h3>Monatsverdienst</h3>
              <p className="amount">{monthData.totalEarnings.toFixed(2)} €</p>
            </div>
            
            {monthData.trips.length > 0 && <h4>Abgerechnete Fahrten</h4>}
            {monthData.trips.map(trip => (
                <div key={trip.id} className="trip-card settled">
                    <div className="card-header">
                        <div className="card-path">
                            <span className="license-plate-badge">{trip.licensePlate}</span>
                            <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                        </div>
                    </div>
                    {trip.notes && <div className="card-notes"><p>{trip.notes}</p></div>}
                    <div className="card-payment">
                       {`Einnahme: ${trip.payment.amount.toFixed(2)} €`}
                    </div>
                </div>
            ))}

            {monthData.expenses.length > 0 && <h4>Erstattete Ausgaben</h4>}
            {monthData.expenses.map(expense => (
                 <div key={expense.id} className="expense-card reimbursed">
                    <div className="card-header">
                        <span>{expense.description}</span>
                    </div>
                    <div className="expense-amount">
                        {expense.amount.toFixed(2)} €
                    </div>
                </div>
            ))}
          </div>
        </div>
      );
    }
    
    return (
        <div className="archive-overlay">
            <header className="archive-header">
                <button className="header-btn" onClick={onClose}>Zurück</button>
                <h2>Archiv</h2>
                <div style={{width: '50px'}}></div> {/* Spacer */}
            </header>
            <div className="archive-content">
                {sortedMonthKeys.length > 0 ? (
                    <div className="archive-month-list">
                        {sortedMonthKeys.map(key => (
                            <button key={key} className="archive-month-item" onClick={() => setSelectedMonthKey(key)}>
                                <span>{formatMonth(key)}</span>
                                <span>{archiveData[key].totalEarnings.toFixed(2)} €</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <h2>Archiv ist leer</h2>
                        <p>Abgerechnete Fahrten und Ausgaben erscheinen hier.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MODAL TO ASSIGN TRIP (BOSS) ---
const AssignTripModal = ({ isOpen, onClose, drivers, onTripAssigned }: { 
    isOpen: boolean; 
    onClose: () => void; 
    drivers: string[];
    onTripAssigned: () => void;
}) => {
    const [messageText, setMessageText] = useState('');
    const [selectedDriver, setSelectedDriver] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const ai = useMemo(() => process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null, []);

    const parseTripWithAI = async (text: string) => {
        if (!ai) {
            throw new Error("API-Schlüssel für KI-Dienst nicht konfiguriert.");
        }
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                start: { type: Type.STRING, description: "Die genaue Start- oder Abholadresse." },
                destination: { type: Type.STRING, description: "Die genaue Zieladresse." },
                amount: { type: Type.NUMBER, description: "Der Preis oder Betrag für die Fahrt in Euro." },
                notes: { type: Type.STRING, description: "Alle zusätzlichen Informationen wie Name des Kunden, Anzahl Personen, besondere Wünsche oder sonstige Details." },
                pickupTime: { type: Type.STRING, description: "Das genaue Datum und die Uhrzeit der Abholung. Konvertiere explizit deutsche Datumsformate (z.B. 'Di., 19. Aug. 2025' oder '19.08.2025 um 15:00 Uhr') in einen ISO 8601 String (YYYY-MM-DDTHH:mm:ss). Extrahiere das Jahr aus dem Text, wenn vorhanden. Wenn kein Jahr im Text steht, verwende das aktuelle Jahr."}
            },
            required: ["start", "destination", "amount", "notes", "pickupTime"]
        };

        const prompt = `Du bist ein KI-Assistent für eine Taxizentrale in Deutschland. Deine Aufgabe ist es, aus einer Textnachricht strukturierte Fahrtdaten zu extrahieren und als JSON zurückzugeben.

**Anweisungen:**
1.  **pickupTime**: Finde das Datum und die Uhrzeit. Kombiniere sie zu einem ISO 8601 String (Format: YYYY-MM-DDTHH:mm:ss). Achte genau auf deutsche Formate wie "19.08.2025" oder "Di, 19. Aug". Wenn kein Jahr angegeben ist, nimm das aktuelle Jahr. Wenn keine Zeit oder kein Datum gefunden werden kann, gib einen leeren String "" zurück.
2.  **start**: Die genaue Abholadresse.
3.  **destination**: Die genaue Zieladresse.
4.  **amount**: Der Preis in Euro als Zahl.
5.  **notes**: Alle anderen relevanten Details (Name, Personenzahl, besondere Wünsche).

**Beispiel:**
Nachricht: "Hallo, wir brauchen ein Taxi für Trudi Köllen, 4 Personen, von Blumenstr. 21 nach Westfalenhalle Dortmund am 19.08.2025 um 15:00 Uhr. Preis ist 200,-."
Erwartetes JSON: {"start":"Blumenstr. 21","destination":"Westfalenhalle Dortmund","amount":200,"notes":"Kunde: Trudi Köllen, 4 Personen","pickupTime":"2025-08-19T15:00:00"}

**Zu analysierende Nachricht:**
"${text}"`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        
        const parsedJson = JSON.parse(result.text);
        return parsedJson as Omit<AssignedTrip, 'id' | 'status'>;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!messageText || !selectedDriver) {
            setError("Bitte Nachricht einfügen und einen Fahrer auswählen.");
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            const parsedData = await parseTripWithAI(messageText);
            
            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                body: JSON.stringify({
                    dataType: 'assign_trip',
                    assignTo: selectedDriver,
                    ...parsedData,
                    pickupTime: parsedData.pickupTime || ''
                }),
            });
            
            setMessageText('');
            setSelectedDriver('');
            onTripAssigned();
            onClose();

        } catch (err: any) {
            console.error("Fehler bei der KI-Analyse oder Zuweisung:", err);
            setError(err.message || "Ein Fehler ist aufgetreten.");
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Neue Fahrt zuweisen</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="trip-message">WhatsApp-Nachricht / E-Mail Text</label>
                        <textarea
                            id="trip-message"
                            rows={8}
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Kopieren Sie hier den vollständigen Text der Anfrage hinein..."
                            required
                            disabled={isLoading}
                        ></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="driver-select">Fahrer auswählen</label>
                        <select
                            id="driver-select"
                            value={selectedDriver}
                            onChange={(e) => setSelectedDriver(e.target.value)}
                            required
                            disabled={isLoading || drivers.length === 0}
                        >
                            <option value="" disabled>{drivers.length === 0 ? "Keine Fahrer gefunden" : "Bitte auswählen..."}</option>
                            {drivers.map(driver => (
                                <option key={driver} value={driver}>{driver}</option>
                            ))}
                        </select>
                    </div>
                     {error && <p className="auth-error">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
                            Abbrechen
                        </button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Analysiere...' : 'Fahrt auswerten & zuweisen'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- BOSS VIEW COMPONENT ---
const BossView = ({ trips, drivers, initialAssignedTrips, onLogout }: { 
    trips: Trip[], 
    drivers: string[], 
    initialAssignedTrips: AssignedTrip[],
    onLogout: () => void 
}) => {
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [cockpitTrips, setCockpitTrips] = useState<AssignedTrip[]>(initialAssignedTrips);

    const fetchCockpitData = async () => {
        try {
            const response = await fetch(`${GOOGLE_SHEET_URL}?action=getCockpitData&user=chef`);
            const result = await response.json();
            if (result.status === 'success') {
                setCockpitTrips(result.assignedTrips || []);
            }
        } catch (error) {
            console.error("Failed to refresh cockpit data:", error);
        }
    };

    useEffect(() => {
        const intervalId = setInterval(fetchCockpitData, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId);
    }, []);

    const statsByMonth = useMemo(() => {
        const groupedByMonth = trips.reduce((acc, trip) => {
            const dateString = trip.id.substring(0, 24);
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return acc;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[monthKey]) {
                acc[monthKey] = {
                    totalRevenue: 0,
                    byPlate: {} as Record<string, number>,
                    byDriver: {} as Record<string, number>,
                    trips: [] as Trip[],
                };
            }
            
            const revenue = trip.payment.amount;
            acc[monthKey].totalRevenue += revenue;
            acc[monthKey].trips.push(trip);
            const plate = trip.licensePlate;
            acc[monthKey].byPlate[plate] = (acc[monthKey].byPlate[plate] || 0) + revenue;
            const driver = trip.username || 'Unbekannt';
            acc[monthKey].byDriver[driver] = (acc[monthKey].byDriver[driver] || 0) + revenue;
            
            return acc;
        }, {} as Record<string, { totalRevenue: number, byPlate: Record<string, number>, byDriver: Record<string, number>, trips: Trip[] }>);
        
        Object.values(groupedByMonth).forEach(month => {
            month.trips.sort((a, b) => new Date(b.id.substring(0, 24)).getTime() - new Date(a.id.substring(0, 24)).getTime());
        });

        return groupedByMonth;
    }, [trips]);

    const sortedMonthKeys = Object.keys(statsByMonth).sort().reverse();
    const sortedCockpitTrips = useMemo(() => 
        [...cockpitTrips].sort((a,b) => {
            const timeA = a.pickupTime ? new Date(a.pickupTime).getTime() : 0;
            const timeB = b.pickupTime ? new Date(b.pickupTime).getTime() : 0;
            return timeA - timeB;
        }), 
    [cockpitTrips]);


    const formatDate = (dateString: string, includeTime = false) => {
      try {
        if (!dateString) return "Zeit n.a.";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Zeit n.a.';
        const options: Intl.DateTimeFormatOptions = includeTime 
            ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
            : { day: '2-digit', month: '2-digit', year: 'numeric' };
        return date.toLocaleDateString('de-DE', options);
      } catch (e) {
        return 'Zeit n.a.';
      }
    };
    
    const getStatusInfo = (status: AssignedTrip['status']) => {
        switch (status) {
            case 'accepted':
                return { text: 'Akzeptiert', className: 'status-accepted' };
            case 'declined':
                return { text: 'Abgelehnt', className: 'status-declined' };
            case 'pending':
            default:
                return { text: 'Ausstehend', className: 'status-pending' };
        }
    };

    if (selectedMonthKey && statsByMonth[selectedMonthKey]) {
        const monthData = statsByMonth[selectedMonthKey];
        return (
            <>
                <header>
                    <div className="header-content">
                        <button className="header-btn" onClick={() => setSelectedMonthKey(null)}>Zurück</button>
                        <h1 style={{fontSize: '1.2rem'}}>Details: {formatMonth(selectedMonthKey)}</h1>
                         <button className="logout-btn" onClick={onLogout}>Logout</button>
                    </div>
                </header>
                <main className="boss-container">
                    <div className="list-container">
                        {monthData.trips.map(trip => (
                             <div key={trip.id} className="trip-card boss-trip-card">
                                <div className="card-header">
                                    <div className="card-path">
                                        <span className="license-plate-badge">{trip.licensePlate}</span>
                                        <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                    </div>
                                    <span className="boss-trip-date">{formatDate(trip.id)}</span>
                                </div>
                                <div className="card-details">
                                    <span className="detail-badge">Fahrer: {trip.username || 'N/A'}</span>
                                </div>
                                <div className={`card-payment ${trip.payment.type}`}>
                                    Umsatz: {trip.payment.amount.toFixed(2)} € ({trip.payment.type === 'cash' ? 'Bar' : 'Rechnung'})
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </>
        );
    }
    
    return (
        <>
            <AssignTripModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} drivers={drivers} onTripAssigned={fetchCockpitData} />
            <header>
                <div className="header-content">
                    <h1>Chef-Dashboard</h1>
                    <div className="header-actions">
                         <button className="header-btn" onClick={() => setIsAssignModalOpen(true)}>Fahrt zuweisen</button>
                        <button className="logout-btn" onClick={onLogout}>Logout</button>
                    </div>
                </div>
            </header>
            <main className="boss-container">
                <div className="cockpit-section">
                    <h2>Dispositions-Cockpit</h2>
                    {sortedCockpitTrips.length === 0 ? (
                        <p className="cockpit-empty">Keine zugewiesenen Fahrten offen.</p>
                    ) : (
                        <div className="cockpit-list">
                            {sortedCockpitTrips.map(trip => {
                                const isUrgent = trip.pickupTime && (new Date(trip.pickupTime).getTime() - Date.now() < 30 * 60 * 1000);
                                const currentStatus = trip.status || 'pending';
                                const needsAttention = isUrgent && currentStatus === 'pending';
                                const statusInfo = getStatusInfo(currentStatus);

                                const itemClasses = ['cockpit-item'];
                                if (needsAttention) itemClasses.push('cockpit-item-warning');
                                if (currentStatus === 'declined') itemClasses.push('cockpit-item-declined');

                                return (
                                    <div key={trip.id} className={itemClasses.join(' ')}>
                                        <div className="cockpit-item-main">
                                            <div className="cockpit-item-path"><strong>{trip.start}</strong> → <strong>{trip.destination}</strong></div>
                                            <div className="cockpit-item-time">Abholung: {formatDate(trip.pickupTime, true)} Uhr</div>
                                            <div className="cockpit-item-driver">Fahrer: {trip.driver}</div>
                                        </div>
                                        <div className="cockpit-item-status">
                                            <span className={`status-badge ${statusInfo.className}`}>{statusInfo.text}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {sortedMonthKeys.length === 0 ? (
                    <div className="empty-state">
                        <h2>Keine Fahrten erfasst</h2>
                        <p>Sobald Fahrer Fahrten erfassen, erscheinen hier die Statistiken.</p>
                    </div>
                ) : (
                    sortedMonthKeys.map(monthKey => {
                        const monthData = statsByMonth[monthKey];
                        const sortedPlates = Object.keys(monthData.byPlate).sort();
                        const sortedDrivers = Object.keys(monthData.byDriver).sort();

                        return (
                            <div key={monthKey} className="boss-month-section" onClick={() => setSelectedMonthKey(monthKey)} role="button" tabIndex={0}>
                                <div className="boss-month-header">
                                    <h2>{formatMonth(monthKey)}</h2>
                                    <div className="boss-month-total">
                                        <span>Gesamtumsatz:</span>
                                        <strong>{monthData.totalRevenue.toFixed(2)} €</strong>
                                    </div>
                                </div>
                                <div className="boss-stats-grid">
                                    <div className="boss-stats-table-container">
                                        <h3>Umsatz pro Fahrzeug</h3>
                                        <table className="boss-stats-table">
                                            <thead>
                                                <tr>
                                                    <th>Kennzeichen</th>
                                                    <th>Umsatz</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedPlates.map(plate => (
                                                    <tr key={plate}>
                                                        <td>{plate}</td>
                                                        <td>{monthData.byPlate[plate].toFixed(2)} €</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="boss-stats-table-container">
                                        <h3>Umsatz pro Fahrer</h3>
                                        <table className="boss-stats-table">
                                            <thead>
                                                <tr>
                                                    <th>Fahrer</th>
                                                    <th>Umsatz</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedDrivers.map(driver => (
                                                    <tr key={driver}>
                                                        <td>{driver}</td>
                                                        <td>{monthData.byDriver[driver].toFixed(2)} €</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </>
    );
};

const Toast = ({ message, onClear }: { message: string, onClear: () => void }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClear();
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [message, onClear]);

    if (!message) return null;

    return <div className="toast-notification">{message}</div>;
};

// Main App component for Drivers
const App = ({ username, initialData, onLogout }: { 
    username: string, 
    initialData: { trips: Trip[], expenses: Expense[], assignedTrips: AssignedTrip[] },
    onLogout: () => void 
}) => {
  const [trips, setTrips] = useState<Trip[]>(initialData.trips);
  const [expenses, setExpenses] = useState<Expense[]>(initialData.expenses);
  const [assignedTrips, setAssignedTrips] = useState<AssignedTrip[]>(initialData.assignedTrips);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripToStart, setTripToStart] = useState<AssignedTrip | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'trips' | 'expenses' | 'stats'>('trips');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [confirmModalProps, setConfirmModalProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmButtonText: 'OK',
    isDestructive: false,
  });

  const syncTrip = async (trip: Trip) => {
    if (!GOOGLE_SHEET_URL) return;
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        body: JSON.stringify({ dataType: 'trip', ...trip, username }),
      });
    } catch (error) {
      console.error("Failed to sync trip:", error);
    }
  };

  const syncExpense = async (expense: Expense) => {
    if (!GOOGLE_SHEET_URL) return;
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        body: JSON.stringify({ dataType: 'expense', ...expense, username }),
      });
    } catch (error) {
      console.error("Failed to sync expense:", error);
    }
  };

  const updateAssignedTripStatus = async (id: string, status: 'accepted' | 'declined') => {
    setAssignedTrips(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ dataType: 'update_assigned_trip_status', id, status, username }),
        });
    } catch (error) {
        console.error("Failed to update trip status:", error);
    }
  };

  const handleStartAssignedTrip = (assignedTrip: AssignedTrip) => {
    setTripToStart(assignedTrip);
    setIsTripModalOpen(true);
  };

  const handleAddTrip = async (newTripData: Omit<Trip, 'id' | 'isSettled' | 'username'>) => {
    const newTrip: Trip = {
      id: new Date().toISOString() + Math.random().toString(36).substr(2, 9),
      ...newTripData, isSettled: false,
    };
    setTrips(prevTrips => [newTrip, ...prevTrips]);
    await syncTrip(newTrip);
    setToastMessage('✅ Fahrt erfolgreich gespeichert!');

    if (tripToStart) {
        setAssignedTrips(prev => prev.filter(t => t.id !== tripToStart.id));
        try {
            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                body: JSON.stringify({ dataType: 'remove_assigned_trip', id: tripToStart.id, username }),
            });
        } catch (error) {
            console.error("Failed to remove assigned trip:", error);
        }
        setTripToStart(null);
    }
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
    if (settledTrip) syncTrip(settledTrip);
  };

  const handleAddExpense = (newExpenseData: Omit<Expense, 'id' | 'isReimbursed' | 'username'>) => {
    const newExpense: Expense = {
        id: new Date().toISOString() + Math.random().toString(36).substr(2, 9),
        ...newExpenseData, isReimbursed: false,
    };
    setExpenses(prevExpenses => [newExpense, ...prevExpenses]);
    syncExpense(newExpense);
    setToastMessage('✅ Ausgabe erfolgreich gespeichert!');
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
    if (reimbursedExpense) syncExpense(reimbursedExpense);
  };

  const handleSettleAll = () => {
    setConfirmModalProps({
      title: 'Alles abrechnen', message: 'Möchten Sie wirklich alle offenen Fahrten und Ausgaben als abgerechnet markieren?',
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
        newlySettledTrips.forEach(syncTrip);
        newlyReimbursedExpenses.forEach(syncExpense);
        setIsConfirmModalOpen(false);
        setToastMessage('✅ Alle Posten wurden abgerechnet.');
      },
      confirmButtonText: 'Ja, alles abrechnen', isDestructive: false,
    });
    setIsConfirmModalOpen(true);
  };
  
    const handleSendSupportTicket = async (message: string, attachedTripId: string | null) => {
      try {
          const response = await fetch(GOOGLE_SHEET_URL, {
              method: 'POST',
              body: JSON.stringify({
                  dataType: 'support_ticket',
                  username,
                  message,
                  attachedTripId: attachedTripId || '',
              }),
          });
          
          if (!response.ok) {
              throw new Error('Kommunikationsfehler mit dem Server.');
          }

          const result = await response.json();
          if (result.status === 'error') {
              throw new Error(result.message);
          }
          
          setToastMessage('✅ Support-Ticket erfolgreich gesendet!');
          setIsSupportModalOpen(false);
      } catch (error: any) {
          console.error("Failed to send support ticket:", error);
          setToastMessage(`❌ Fehler: ${error.message || 'Ticket konnte nicht gesendet werden.'}`);
      }
  };

  const { openCashCollected, openInvoiceIssued, openExpenses, openMyEarnings, amountToBoss } = useMemo(() => {
    const unsettledTrips = trips.filter(trip => !trip.isSettled);
    const unreimbursedExpenses = expenses.filter(expense => !expense.isReimbursed);
    const openCashCollected = unsettledTrips.filter(t => t.payment.type === 'cash' && t.iCollectedPayment).reduce((s, t) => s + t.payment.amount, 0);
    const openInvoiceIssued = unsettledTrips.filter(t => t.payment.type === 'invoice' && t.iCollectedPayment).reduce((s, t) => s + t.payment.amount, 0);
    const openUserShare = unsettledTrips.reduce((s, t) => s + (t.payment.amount * 0.5) / t.numberOfDrivers, 0);
    const openExpenses = unreimbursedExpenses.reduce((s, e) => s + e.amount, 0);
    const openMyEarnings = openUserShare;
    const amountToBoss = openCashCollected - openUserShare - openExpenses;
    return { openCashCollected, openInvoiceIssued, openExpenses, openMyEarnings, amountToBoss };
  }, [trips, expenses]);

  const openTrips = useMemo(() => trips.filter(trip => !trip.isSettled), [trips]);
  const openExpensesList = useMemo(() => expenses.filter(expense => !expense.isReimbursed), [expenses]);
  
  const formatAssignedTripTime = (isoString: string) => {
    if (!isoString) return "Zeit n.a.";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Zeit n.a.";
    return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  
  const renderContent = () => {
    switch (activeView) {
        case 'trips':
            const visibleAssignedTrips = assignedTrips.filter(t => t.status !== 'declined');
            return (
                <>
                    {visibleAssignedTrips.length > 0 && (
                        <div className="assigned-trips-section">
                            <h3>Zugewiesene Fahrten</h3>
                            {visibleAssignedTrips.map(atrip => {
                                const isUrgent = atrip.pickupTime && new Date(atrip.pickupTime).getTime() - Date.now() < 30 * 60 * 1000;
                                const currentStatus = atrip.status || 'pending';
                                return (
                                <div key={atrip.id} className={`assigned-trip-card ${isUrgent && currentStatus === 'accepted' ? 'trip-reminder-highlight' : ''}`}>
                                    <div className="card-path">
                                        <strong>{atrip.start || 'Unbekannt'}</strong> → <strong>{atrip.destination || 'Unbekannt'}</strong>
                                    </div>
                                    <div className="card-details">
                                        <span className="detail-badge">Abholung: {formatAssignedTripTime(atrip.pickupTime)}</span>
                                    </div>
                                    {atrip.notes && <div className="card-notes"><p>{atrip.notes}</p></div>}
                                    <div className="card-payment">
                                       Preis: {atrip.amount ? `${atrip.amount.toFixed(2)} €` : 'Unbekannt'}
                                    </div>
                                    <div className="card-actions">
                                        {currentStatus === 'pending' && (
                                            <>
                                                <button className="btn-secondary" onClick={() => updateAssignedTripStatus(atrip.id, 'declined')}>Ablehnen</button>
                                                <button className="btn-primary" onClick={() => updateAssignedTripStatus(atrip.id, 'accepted')}>Akzeptieren</button>
                                            </>
                                        )}
                                        {currentStatus === 'accepted' && (
                                            <button className="btn-primary" onClick={() => handleStartAssignedTrip(atrip)}>Fahrt beginnen</button>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                    {openTrips.length === 0 && visibleAssignedTrips.length === 0 ? (
                        <div className="empty-state">
                            <h2>Willkommen, {username}!</h2>
                            <p>Keine offenen Fahrten. Fügen Sie eine neue Fahrt über das '+' Symbol hinzu oder schauen Sie ins Archiv.</p>
                        </div>
                    ) : openTrips.length > 0 && (
                        <div className="list-container">
                            {openTrips.map(trip => (
                                <div key={trip.id} className="trip-card">
                                    <div className="card-header">
                                        <div className="card-path">
                                            <span className="license-plate-badge">{trip.licensePlate}</span>
                                            <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                        </div>
                                    </div>
                                    <div className="card-details">
                                        {trip.numberOfDrivers > 1 && (<span className="detail-badge">Gruppenfahrt ({trip.numberOfDrivers} Fahrer)</span>)}
                                        <span className="detail-badge">{trip.iCollectedPayment ? 'Bezahlung erhalten' : 'Bezahlung durch Kollegen'}</span>
                                    </div>
                                    {trip.notes && (<div className="card-notes"><p>{trip.notes}</p></div>)}
                                    <div className={`card-payment ${trip.payment.type}`}>
                                        {trip.payment.type === 'cash' ? `Bar erhalten: ${trip.payment.amount.toFixed(2)} €` : `Per Rechnung: ${trip.payment.amount.toFixed(2)} €`}
                                    </div>
                                    <div className="card-actions">
                                      <button onClick={() => handleSettleTrip(trip.id)} className="settle-btn">Mit Chef abrechnen</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="add-fab" onClick={() => { setTripToStart(null); setIsTripModalOpen(true); }} aria-label="Fahrt hinzufügen">+</button>
                </>
            );
        case 'expenses':
            return (
                <>
                    {openExpensesList.length === 0 ? (
                         <div className="empty-state">
                            <h2>Keine offenen Ausgaben</h2>
                            <p>Fügen Sie eine neue Ausgabe über das '+' Symbol hinzu oder schauen Sie ins Archiv.</p>
                        </div>
                    ) : (
                        <div className="list-container">
                            {openExpensesList.map(expense => (
                                <div key={expense.id} className="expense-card">
                                    <div className="card-header">
                                        <span>{expense.description}</span>
                                    </div>
                                    <div className="expense-amount">{expense.amount.toFixed(2)} €</div>
                                    <div className="card-actions">
                                      <button onClick={() => handleReimburseExpense(expense.id)} className="reimburse-btn">Vom Chef erstatten</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="add-fab" onClick={() => setIsExpenseModalOpen(true)} aria-label="Ausgabe hinzufügen">+</button>
                </>
            );
        case 'stats':
            return (
                <div className="stats-grid">
                    <div className="stat-card large settle-all-card">
                        <h3>Offene Posten abrechnen</h3>
                        <p>Markiert alle Fahrten als abgerechnet und alle Ausgaben als erstattet.</p>
                        <button type="button" className="btn-primary settle-all-btn" onClick={handleSettleAll}>Alles abrechnen</button>
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
                <div className="header-actions">
                    <button className="header-btn" onClick={() => setIsArchiveOpen(true)}>Archiv</button>
                    <button className="header-btn" onClick={() => setIsSupportModalOpen(true)}>Support</button>
                    <button className="logout-btn" onClick={onLogout}>Logout</button>
                </div>
            </div>
        </header>
        <main className="app-container">{renderContent()}</main>
        <nav className="bottom-nav">
            <button className={`nav-btn ${activeView === 'trips' ? 'active' : ''}`} onClick={() => setActiveView('trips')}>Fahrten</button>
            <button className={`nav-btn ${activeView === 'expenses' ? 'active' : ''}`} onClick={() => setActiveView('expenses')}>Ausgaben</button>
            <button className={`nav-btn ${activeView === 'stats' ? 'active' : ''}`} onClick={() => setActiveView('stats')}>Statistik</button>
        </nav>
        <AddTripModal isOpen={isTripModalOpen} onClose={() => setIsTripModalOpen(false)} onSave={handleAddTrip} initialData={tripToStart || undefined} />
        <AddExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onSave={handleAddExpense} />
        <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} {...confirmModalProps} />
        <SupportModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} onSubmit={handleSendSupportTicket} openTrips={openTrips} />
        {isArchiveOpen && <ArchiveView trips={trips} expenses={expenses} onClose={() => setIsArchiveOpen(false)} />}
        <Toast message={toastMessage} onClear={() => setToastMessage('')} />
    </>
  );
};

// --- AUTHENTICATION COMPONENTS ---

const LoginScreen = ({ onLogin, onSwitchToRegister }: { onLogin: (username: string, password: string) => Promise<void>, onSwitchToRegister: () => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await onLogin(username, password);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
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
                            disabled={isLoading}
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
                            disabled={isLoading}
                        />
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="btn-primary auth-btn" disabled={isLoading}>
                        {isLoading ? 'Anmelden...' : 'Anmelden'}
                    </button>
                </form>
                <div className="auth-switch-text">
                    Noch kein Konto? <button onClick={onSwitchToRegister} className="auth-switch-button">Jetzt registrieren</button>
                </div>
            </div>
        </div>
    );
};

const RegistrationScreen = ({ onRegister, onSwitchToLogin }: { onRegister: (username: string, password: string) => Promise<void>, onSwitchToLogin: () => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (username.toLowerCase() === 'chef') {
            setError('Dieser Benutzername ist reserviert.');
            return;
        }
        if (!username || !password) {
            setError('Bitte Benutzername und Passwort eingeben.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            await onRegister(username, password);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
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
                             disabled={isLoading}
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
                             disabled={isLoading}
                        />
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="btn-primary auth-btn" disabled={isLoading}>
                        {isLoading ? 'Erstellen...' : 'Konto erstellen'}
                    </button>
                </form>
                <div className="auth-switch-text">
                    Schon ein Konto? <button onClick={onSwitchToLogin} className="auth-switch-button">Jetzt anmelden</button>
                </div>
            </div>
        </div>
    );
};

const AppContainer = () => {
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [appData, setAppData] = useState<{ trips: Trip[], expenses: Expense[], assignedTrips: AssignedTrip[], drivers: string[] }>({ trips: [], expenses: [], assignedTrips: [], drivers: [] });
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const [isBookingMode, setIsBookingMode] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('booking') === 'true') {
            setIsBookingMode(true);
            setIsDataLoading(false);
            return;
        }

        const loggedInUser = localStorage.getItem('fahrtenbuch-currentUser');
        if (loggedInUser) {
            setCurrentUser(loggedInUser);
        } else {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;
            setIsDataLoading(true);
            
            if (!GOOGLE_SHEET_URL) {
                console.warn("Google Sheet URL is not configured.");
                setIsDataLoading(false);
                return;
            }
            
            try {
                const response = await fetch(`${GOOGLE_SHEET_URL}?action=getData&user=${encodeURIComponent(currentUser)}`);
                if (!response.ok) throw new Error(`Serverfehler: ${response.statusText}`);
                
                const result = await response.json();
                if (result.status === 'error') throw new Error(result.message);
                
                setAppData({
                    trips: (result.trips || []).filter((t: any) => t && t.id).map((t: any) => ({ ...t, isSettled: t.isSettled || false })),
                    expenses: (result.expenses || []).filter((e: any) => e && e.id).map((e: any) => ({ ...e, isReimbursed: e.isReimbursed || false })),
                    assignedTrips: (result.assignedTrips || []).filter((t: any) => t && t.id),
                    drivers: result.drivers || [],
                });

            } catch (error: any) {
                console.error("Error loading data from Google Sheet:", error);
                alert(`Fehler beim Laden der Daten: ${error.message}`);
            } finally {
                setIsDataLoading(false);
            }
        };
        fetchData();
    }, [currentUser]);

    const handleLogin = async (username: string, password: string) => {
        if (!GOOGLE_SHEET_URL) throw new Error("App ist nicht konfiguriert.");
        
        const response = await fetch(`${GOOGLE_SHEET_URL}?action=login&user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}`);
        if(!response.ok) throw new Error("Kommunikationsfehler mit dem Server.");
        
        const result = await response.json();
        if (result.status === 'error' || !result.loggedIn) {
            throw new Error(result.message || 'Anmeldung fehlgeschlagen.');
        }

        localStorage.setItem('fahrtenbuch-currentUser', username);
        setCurrentUser(username);
    };

    const handleRegister = async (username: string, password: string) => {
        if (!GOOGLE_SHEET_URL) throw new Error("App ist nicht konfiguriert.");

        const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ dataType: 'user_register', username, password }),
        });

        if (!response.ok) throw new Error("Fehler bei der Registrierung.");
        const result = await response.json();

        if (result.status === 'error') {
            throw new Error(result.message);
        }
        
        await handleLogin(username, password);
    };

    const handleLogout = () => {
        localStorage.removeItem('fahrtenbuch-currentUser');
        setCurrentUser(null);
        setAppData({ trips: [], expenses: [], assignedTrips: [], drivers: [] });
        setAuthView('login');
    };

    if (isDataLoading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Daten werden geladen...</p>
            </div>
        );
    }

    if (isBookingMode) {
        return <CustomerBookingForm />;
    }

    if (!currentUser) {
        return authView === 'login' 
            ? <LoginScreen onLogin={handleLogin} onSwitchToRegister={() => setAuthView('register')} />
            : <RegistrationScreen onRegister={handleRegister} onSwitchToLogin={() => setAuthView('login')} />;
    }
    
    if (currentUser.toLowerCase() === 'chef') {
        return <BossView trips={appData.trips} drivers={appData.drivers} initialAssignedTrips={appData.assignedTrips} onLogout={handleLogout} />;
    }

    return <App username={currentUser} initialData={appData} onLogout={handleLogout} />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AppContainer />);
}