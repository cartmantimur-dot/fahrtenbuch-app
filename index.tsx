import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const GOOGLE_SHEET_URL: string = 'https://script.google.com/macros/s/AKfycbwbJpfxa0q32gpWT-5WCx1z2MHtYrY2MjGg0v7mluLNmO0YO3EDT1xsRyNY1GLs7mdyhg/exec';

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
    wurdeBearbeitet?: boolean;
    bearbeitungsdatum?: string;
    originalStart?: string;
    originalZiel?: string;
    originalBetrag?: number;
    originalZahlungsart?: 'cash' | 'invoice';
    originalFahreranzahl?: number;
    originalIchHabeKassiert?: boolean;
    originalNotizen?: string;
    // UI-only: Synchronisationsstatus (lokal)
    syncStatus?: 'pending' | 'synced';
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

// Car rental entries
interface CarRental {
    id: string;
    username?: string;
    licensePlate: string;
    start: string; // ISO
    end: string;   // ISO
    amount: number;
}

// --- NEW CUSTOMER BOOKING FORM ---
const CustomerBookingForm = () => {
    const COLOGNE_AIRPORT = { street: 'Flughafen Köln/Bonn (CGN)', plz: '51147' };
    const DUSSELDORF_AIRPORT = { street: 'Flughafen Düsseldorf (DUS)', plz: '40474' };

    const [pickupLocations, setPickupLocations] = useState<Address[]>([{ street: '', plz: '' }]);
    const [destinations, setDestinations] = useState<Address[]>([{ street: '', plz: '' }]);
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

    const handleDestinationChange = (index: number, field: keyof Address, value: string) => {
        const newDestinations = [...destinations];
        newDestinations[index][field] = value;
        setDestinations(newDestinations);
    };

    const addPickupLocation = () => {
        setPickupLocations([...pickupLocations, { street: '', plz: '' }]);
    };

    const removePickupLocation = (index: number) => {
        if (pickupLocations.length > 1) {
            setPickupLocations(pickupLocations.filter((_, i) => i !== index));
        }
    };

    const addDestination = () => {
        setDestinations([...destinations, { street: '', plz: '' }]);
    };

    const removeDestination = (index: number) => {
        if (destinations.length > 1) {
            setDestinations(destinations.filter((_, i) => i !== index));
        }
    };

    const setPickupAsAirport = (airport: Address) => {
        const newLocations = [...pickupLocations];
        newLocations[0] = airport;
        setPickupLocations(newLocations);
        setIsAirportPickup(true);
    };

    const setDestinationAsAirport = (airport: Address) => {
        const newDestinations = [...destinations];
        newDestinations[0] = airport;
        setDestinations(newDestinations);
    };


    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const arePickupsInvalid = pickupLocations.some(loc => !loc.street || !loc.plz);
        const areDestinationsInvalid = destinations.some(loc => !loc.street || !loc.plz);
        if (!customerName || !customerPhone || !passengerCount || !pickupDate || !pickupTime || arePickupsInvalid || areDestinationsInvalid) {
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

        const destinationsString = destinations
            .map(loc => `- ${loc.street}, ${loc.plz}`)
            .join('\n');

        const formattedDate = new Date(pickupDate).toLocaleDateString('de-DE', {
            weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
        });

        let message = `*Neue Fahrtanfrage*\n\n`;
        message += `*Kunde:* ${customerName}\n`;
        message += `*Telefon:* ${customerPhone}\n`;
        message += `*Anzahl Personen:* ${passengerCount}\n\n`;
        message += `*Abholung:*\n${pickupLocationsString}\n\n`;
        message += `*Ziel(e):*\n${destinationsString}\n\n`;

        const timeLabel = isAirportPickup ? 'Landezeit' : 'Abholzeit';
        message += `*Abholdatum:* ${formattedDate}\n`;
        message += `*${timeLabel}:* ${pickupTime} Uhr\n`;

        if (isAirportPickup && flightNumber) {
            message += `*Flugnummer:* ${flightNumber}\n`;
        }

        // --- RENT CAR MODAL (only for Franco) ---
        const RentCarModal = ({ isOpen, onClose, onSave, plates }: { isOpen: boolean, onClose: () => void, onSave: (payload: { startISO: string, endISO: string, amount: number, licensePlate: string }) => Promise<void>, plates: string[] }) => {
            const [startDate, setStartDate] = useState('');
            const [endDate, setEndDate] = useState('');
            const [amount, setAmount] = useState('');
            const [selectedPlate, setSelectedPlate] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const [error, setError] = useState('');

            if (!isOpen) return null;

            const buildISO = (date: string) => {
                try {
                    if (!date) return '';
                    const [yyyy, mm, dd] = date.split('-').map(Number);
                    const dt = new Date(yyyy, (mm - 1), dd, 0, 0);
                    return dt.toISOString();
                } catch {
                    return '';
                }
            };

            const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setError('');
                const startISO = buildISO(startDate);
                const endISO = buildISO(endDate);
                const price = parseFloat(amount);

                if (!selectedPlate || !startISO || !endISO || isNaN(price)) {
                    setError('Bitte Zeitraum und Betrag vollständig und gültig angeben.');
                    return;
                }
                if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
                    setError('Ende muss nach dem Start liegen.');
                    return;
                }
                setIsLoading(true);
                try {
                    await onSave({ startISO, endISO, amount: price, licensePlate: selectedPlate });
                    onClose();
                    setStartDate(''); setEndDate(''); setAmount(''); setSelectedPlate('');
                } catch (err: any) {
                    setError(err?.message || 'Speichern fehlgeschlagen.');
                } finally {
                    setIsLoading(false);
                }
            };

            return (
                <div className="modal-overlay white-bg" onClick={onClose}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Auto verleihen</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Kennzeichen</label>
                                <select value={selectedPlate} onChange={e => setSelectedPlate(e.target.value)} required>
                                    <option value="" disabled>Bitte auswählen...</option>
                                    {plates.map(lp => (
                                        <option key={lp} value={lp}>{lp}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Start (Datum)</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Ende (Datum)</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Betrag (€)</label>
                                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
                            </div>
                            {error && <p className="error-text">{error}</p>}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>Abbrechen</button>
                                <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Speichere...' : 'Speichern'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            );
        };

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
                        <label>Zielort(e)</label>
                        <div className="airport-buttons">
                            <button type="button" onClick={() => setDestinationAsAirport(COLOGNE_AIRPORT)}>✈️ Köln/Bonn</button>
                            <button type="button" onClick={() => setDestinationAsAirport(DUSSELDORF_AIRPORT)}>✈️ Düsseldorf</button>
                        </div>
                        {destinations.map((destination, index) => (
                            <div key={index} className="pickup-location-group">
                                <div className="address-group">
                                    <div className="form-group">
                                        <label htmlFor={`destination-street-${index}`} className="sr-only">Straße &amp; Hausnummer</label>
                                        <input
                                            type="text"
                                            id={`destination-street-${index}`}
                                            value={destination.street}
                                            onChange={e => handleDestinationChange(index, 'street', e.target.value)}
                                            placeholder={index === 0 ? "Haupt-Zielort" : "Weiterer Zielort"}
                                            required
                                        />
                                    </div>
                                    <div className="form-group plz-group">
                                        <label htmlFor={`destination-plz-${index}`} className="sr-only">PLZ</label>
                                        <input
                                            type="text"
                                            id={`destination-plz-${index}`}
                                            value={destination.plz}
                                            onChange={e => handleDestinationChange(index, 'plz', e.target.value)}
                                            placeholder="PLZ"
                                            required
                                            pattern="\d{4,5}"
                                            title="Bitte geben Sie eine gültige PLZ ein."
                                        />
                                    </div>
                                </div>
                                {destinations.length > 1 && (
                                    <button type="button" className="remove-location-btn" onClick={() => removeDestination(index)} aria-label="Zielort entfernen">&times;</button>
                                )}
                            </div>
                        ))}
                        <button type="button" className="add-location-btn" onClick={addDestination}>+ Weiteren Zielort hinzufügen</button>
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
                            <label htmlFor="pickupDate">Abholdatum</label>
                            <input type="date" id="pickupDate" value={pickupDate} onChange={e => setPickupDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="pickupTime">{isAirportPickup ? 'Landezeit' : 'Abholzeit'}</label>
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


// The modal component for adding/editing a new trip
const TripFormModal = ({ isOpen, onClose, onSave, initialData, tripToEdit, plates }: {
    isOpen: boolean,
    onClose: () => void,
    onSave: (trip: Omit<Trip, 'id' | 'isSettled' | 'username'>) => void,
    initialData?: Partial<AssignedTrip>,
    tripToEdit?: Trip | null,
    plates: string[]
}) => {
    const [licensePlate, setLicensePlate] = useState('');
    const [start, setStart] = useState('');
    const [destination, setDestination] = useState('');
    const [paymentType, setPaymentType] = useState<'cash' | 'invoice'>('cash');
    const [amount, setAmount] = useState('');
    const [numberOfDrivers, setNumberOfDrivers] = useState('1');
    const [iCollectedPayment, setICollectedPayment] = useState(true);
    const [notes, setNotes] = useState('');

    const isEditMode = !!tripToEdit;

    useEffect(() => {
        const data = tripToEdit || initialData;
        if (isOpen && data) {
            setLicensePlate('licensePlate' in data ? data.licensePlate || '' : '');
            setStart(data.start || '');
            setDestination(data.destination || '');
            if ('payment' in data && data.payment) {
                setPaymentType(data.payment.type);
                setAmount(String(data.payment.amount));
            } else if ('amount' in data) {
                setAmount(String(data.amount));
            }
            if ('numberOfDrivers' in data && data.numberOfDrivers) setNumberOfDrivers(String(data.numberOfDrivers));
            if ('iCollectedPayment' in data) setICollectedPayment(data.iCollectedPayment);
            setNotes(data.notes || '');
        }
    }, [isOpen, tripToEdit, initialData]);


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
                <h2>{isEditMode ? 'Fahrt bearbeiten' : 'Fahrt erfassen'}</h2>
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
                            {plates.map(lp => (
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

// --- RENT CAR MODAL (only for Franco, top-level) ---
const RentCarModal = ({ isOpen, onClose, onSave, plates }: { isOpen: boolean, onClose: () => void, onSave: (payload: { startISO: string, endISO: string, amount: number, licensePlate: string }) => Promise<void>, plates: string[] }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const buildISO = (date: string) => {
        try {
            if (!date) return '';
            const [yyyy, mm, dd] = date.split('-').map(Number);
            const dt = new Date(yyyy, (mm - 1), dd, 0, 0);
            return dt.toISOString();
        } catch {
            return '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const startISO = buildISO(startDate);
        const endISO = buildISO(endDate);
        const price = parseFloat(amount);

        if (!selectedPlate || !startISO || !endISO || isNaN(price)) {
            setError('Bitte Zeitraum und Betrag vollständig und gültig angeben.');
            return;
        }
        if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
            setError('Ende muss nach dem Start liegen.');
            return;
        }
        setIsLoading(true);
        try {
            await onSave({ startISO, endISO, amount: price, licensePlate: selectedPlate });
            onClose();
            setStartDate(''); setEndDate(''); setAmount(''); setSelectedPlate('');
        } catch (err: any) {
            setError(err?.message || 'Speichern fehlgeschlagen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay white-bg" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Auto verleihen</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Kennzeichen</label>
                        <select value={selectedPlate} onChange={e => setSelectedPlate(e.target.value)} required>
                            <option value="" disabled>Bitte auswählen...</option>
                            {plates.map(lp => (
                                <option key={lp} value={lp}>{lp}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Start (Datum)</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Ende (Datum)</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Betrag (€)</label>
                        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    {error && <p className="error-text">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>Abbrechen</button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Speichere...' : 'Speichern'}</button>
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

const ManagePlatesModal = ({ isOpen, onClose, plates, onAdd, onDelete }: {
    isOpen: boolean;
    onClose: () => void;
    plates: string[];
    onAdd: (plate: string) => Promise<void>;
    onDelete: (plate: string) => Promise<void>;
}) => {
    const [newPlate, setNewPlate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleAdd = async (e: FormEvent) => {
        e.preventDefault();
        if (!newPlate.trim()) return;
        setError('');
        setIsLoading(true);
        try {
            await onAdd(newPlate.trim());
            setNewPlate('');
        } catch (err: any) {
            setError(err.message || 'Fehler beim Hinzufügen.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (plate: string) => {
        if (!window.confirm(`Möchten Sie das Kennzeichen "${plate}" wirklich löschen?`)) {
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            await onDelete(plate);
        } catch (err: any) {
            setError(err.message || 'Fehler beim Löschen.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setError('');
        setNewPlate('');
        onClose();
    }

    const sortedPlates = [...plates].sort();

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Kennzeichen verwalten</h2>
                <form onSubmit={handleAdd} className="plate-add-form">
                    <div className="form-group">
                        <label htmlFor="new-plate">Neues Kennzeichen</label>
                        <div className="plate-input-group">
                            <input
                                type="text"
                                id="new-plate"
                                value={newPlate}
                                onChange={(e) => setNewPlate(e.target.value)}
                                placeholder="z.B. BM-AB 123"
                                required
                                disabled={isLoading}
                            />
                            <button type="submit" className="btn-primary" disabled={isLoading || !newPlate.trim()}>
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </form>

                {error && <p className="auth-error">{error}</p>}

                <div className="plate-list">
                    {sortedPlates.length > 0 ? (
                        sortedPlates.map(plate => (
                            <div key={plate} className="plate-item">
                                <span>{plate}</span>
                                <button
                                    className="delete-plate-btn"
                                    onClick={() => handleDelete(plate)}
                                    disabled={isLoading}
                                    aria-label={`Kennzeichen ${plate} löschen`}
                                >
                                    &times;
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="plate-empty-text">Keine Kennzeichen angelegt.</p>
                    )}
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={handleClose} disabled={isLoading}>
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};

const getRelativeDateHeader = (isoString: string) => {
    try {
        if (!isoString) return "Unbekanntes Datum";
        const date = new Date(isoString.substring(0, 24));
        if (isNaN(date.getTime())) return "Unbekanntes Datum";

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Reset time component for accurate date comparison
        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        if (date.getTime() === today.getTime()) return "Heute";
        if (date.getTime() === yesterday.getTime()) return "Gestern";

        return date.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    } catch {
        return "Unbekanntes Datum";
    }
};

const formatTripDateForDisplay = (isoString: string) => {
    try {
        if (!isoString) return "";
        const date = new Date(isoString.substring(0, 24));
        if (isNaN(date.getTime())) return "";

        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    } catch {
        return "";
    }
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
                    <div style={{ width: '50px' }}></div> {/* Spacer */}
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
                <div style={{ width: '50px' }}></div> {/* Spacer */}
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
                pickupTime: { type: Type.STRING, description: "Das genaue Datum und die Uhrzeit der Abholung. Konvertiere explizit deutsche Datumsformate (z.B. 'Di., 19. Aug. 2025' oder '19.08.2025 um 15:00 Uhr') in einen ISO 8601 String (YYYY-MM-DDTHH:mm:ss). Extrahiere das Jahr aus dem Text, wenn vorhanden. Wenn kein Jahr im Text steht, verwende das aktuelle Jahr." }
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


// --- MODAL TO CREATE NEW USER (BOSS) ---
const CreateUserModal = ({ isOpen, onClose, onCreate }: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (username: string, password: string) => Promise<void>;
}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !password) {
            setError('Bitte Benutzername und Passwort eingeben.');
            return;
        }

        setIsLoading(true);
        try {
            await onCreate(username, password);
            setSuccess(`Benutzer ${username} erfolgreich erstellt!`);
            setUsername('');
            setPassword('');
            // Optional: Close after short delay or let user close manually
        } catch (err: any) {
            setError(err.message || 'Fehler beim Erstellen.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setError('');
        setSuccess('');
        setUsername('');
        setPassword('');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Neuen Fahrer anlegen</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="new-username">Benutzername</label>
                        <input
                            type="text"
                            id="new-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="new-password">Passwort</label>
                        <input
                            type="text" // Visible password for boss to see/copy? Or password type?
                            id="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            placeholder="Passwort vergeben"
                        />
                    </div>
                    
                    {error && <p className="auth-error">{error}</p>}
                    {success && <p className="success-text" style={{ color: 'green', marginBottom: '1rem' }}>{success}</p>}

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={handleClose} disabled={isLoading}>
                            Schließen
                        </button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Erstelle...' : 'Fahrer anlegen'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- BOSS VIEW COMPONENT ---
const BossView = ({ trips, expenses = [], rentals = [], drivers, initialAssignedTrips, onLogout, plates, onAddPlate, onDeletePlate, onSwitchToUser, onCreateUser }: {
    trips: Trip[],
    expenses?: Expense[],
    rentals?: CarRental[],
    drivers: string[],
    initialAssignedTrips: AssignedTrip[],
    onLogout: () => void,
    plates: string[],
    onAddPlate: (plate: string) => Promise<void>,
    onDeletePlate: (plate: string) => Promise<void>,
    onSwitchToUser?: () => void,
    onCreateUser: (username: string, password: string) => Promise<void>
}) => {
    const [detailView, setDetailView] = useState<{
        monthKey: string;
        filterType: 'all' | 'plate' | 'driver';
        filterValue: string;
    } | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isManagePlatesModalOpen, setIsManagePlatesModalOpen] = useState(false);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [cockpitTrips, setCockpitTrips] = useState<AssignedTrip[]>(initialAssignedTrips);
    const [toastMessage, setToastMessage] = useState('');

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

    const handleTripAssigned = () => {
        fetchCockpitData();
        setToastMessage('✅ Fahrt erfolgreich zugewiesen!');
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
                    byPlate: {} as Record<string, { revenue: number, count: number }>,
                    byDriver: {} as Record<string, { revenue: number, count: number }>,
                    trips: [] as Trip[],
                };
            }

            const revenue = trip.payment.amount;
            acc[monthKey].totalRevenue += revenue;
            acc[monthKey].trips.push(trip);

            const plate = trip.licensePlate;
            if (!acc[monthKey].byPlate[plate]) {
                acc[monthKey].byPlate[plate] = { revenue: 0, count: 0 };
            }
            acc[monthKey].byPlate[plate].revenue += revenue;
            acc[monthKey].byPlate[plate].count += 1;

            const driver = trip.username || 'Unbekannt';
            if (!acc[monthKey].byDriver[driver]) {
                acc[monthKey].byDriver[driver] = { revenue: 0, count: 0 };
            }
            acc[monthKey].byDriver[driver].revenue += revenue;
            acc[monthKey].byDriver[driver].count += 1;

            return acc;
        }, {} as Record<string, {
            totalRevenue: number,
            byPlate: Record<string, { revenue: number, count: number }>,
            byDriver: Record<string, { revenue: number, count: number }>,
            trips: Trip[]
        }>);

        // Add rental revenues
        rentals.forEach(r => {
            const date = new Date(r.start);
            if (isNaN(date.getTime())) return;
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = {
                    totalRevenue: 0,
                    byPlate: {} as Record<string, { revenue: number, count: number }>,
                    byDriver: {} as Record<string, { revenue: number, count: number }>,
                    trips: [] as Trip[],
                };
            }
            groupedByMonth[monthKey].totalRevenue += r.amount || 0;
            const plate = r.licensePlate;
            if (!groupedByMonth[monthKey].byPlate[plate]) {
                groupedByMonth[monthKey].byPlate[plate] = { revenue: 0, count: 0 };
            }
            groupedByMonth[monthKey].byPlate[plate].revenue += r.amount || 0;
            groupedByMonth[monthKey].byPlate[plate].count += 1; // zählt als eigener Umsatzposten
        });

        Object.values(groupedByMonth).forEach(month => {
            month.trips.sort((a, b) => new Date(b.id.substring(0, 24)).getTime() - new Date(a.id.substring(0, 24)).getTime());
        });

        return groupedByMonth;
    }, [trips, rentals]);

    const sortedMonthKeys = Object.keys(statsByMonth).sort().reverse();
    const sortedCockpitTrips = useMemo(() =>
        [...cockpitTrips].sort((a, b) => {
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

    const [showSettlements, setShowSettlements] = useState(false);
    const [showRentals, setShowRentals] = useState(false);
    const [settlementDriver, setSettlementDriver] = useState<string | null>(null);

    const DRIVER_SHARE_PERCENTAGE = 0.5;

    if (showRentals) {
        const sortedRentals = [...rentals].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
        const totalRentalIncome = sortedRentals.reduce((sum, r) => sum + (r.amount || 0), 0);

        return (
            <>
                <header>
                    <div className="header-content">
                        <button className="header-btn" onClick={() => setShowRentals(false)}>Zurück</button>
                        <h1 style={{ fontSize: '1.2rem', textAlign: 'center' }}>Autoverleih Übersicht</h1>
                        <button className="logout-btn" onClick={onLogout}>Logout</button>
                    </div>
                </header>
                <main className="boss-container">
                    <div className="list-container">
                        <div className="settlement-summary-card" style={{ borderLeft: '5px solid var(--accent-color)' }}>
                            <div className="settlement-row">
                                <span>Gesamt-Einnahmen aus Verleih:</span>
                            </div>
                            <div className="settlement-total-large">{totalRentalIncome.toFixed(2)} €</div>
                            <p style={{ textAlign: 'center', color: '#7f8c8d' }}>{sortedRentals.length} Verleihe erfasst</p>
                        </div>

                        {sortedRentals.length === 0 ? (
                            <div className="empty-state">
                                <h2>Keine Verleiheinträge</h2>
                                <p>Es wurden noch keine Autos verliehen.</p>
                            </div>
                        ) : (
                            sortedRentals.map(r => (
                                <div key={r.id} className="trip-card boss-trip-card">
                                    <div className="card-header">
                                        <div className="card-path">
                                            <span className="license-plate-badge">{r.licensePlate}</span>
                                            <strong>Verleih</strong>
                                        </div>
                                        <span className="boss-trip-date">{formatDate(r.start)} - {formatDate(r.end)}</span>
                                    </div>
                                    <div className="card-details">
                                        {r.username && <span className="detail-badge">Erfasst von: {r.username}</span>}
                                    </div>
                                    <div className="card-payment rental">
                                        Einnahme: {Number(r.amount).toFixed(2)} €
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </>
        );
    }

    if (showSettlements) {
        const unsettledTrips = trips.filter(t => !t.isSettled);

        // Group by driver
        const settlementData = unsettledTrips.reduce((acc, trip) => {
            const driver = trip.username || 'Unbekannt';
            if (!acc[driver]) {
                acc[driver] = { count: 0, totalCash: 0, totalInvoice: 0, trips: [] };
            }
            acc[driver].count++;

            if (trip.payment.type === 'cash') {
                // Nur zählen, wenn der Fahrer das Geld hat (iCollectedPayment). 
                // Wenn nicht, hat er es nicht, also muss er es auch nicht abgeben.
                // Aber für den Umsatz (Verdienst) zählt es trotzdem? 
                // Annahme: Umsatz ist Umsatz. Aber "Offener Barumsatz" (Geld in der Tasche) ist nur was er hat.
                if (trip.iCollectedPayment) {
                    acc[driver].totalCash += trip.payment.amount;
                }
            } else {
                acc[driver].totalInvoice += trip.payment.amount;
            }
            acc[driver].trips.push(trip);
            return acc;
        }, {} as Record<string, { count: number, totalCash: number, totalInvoice: number, trips: Trip[] }>);

        // Add expenses logic
        const driverExpenses = expenses.filter(e => !e.isReimbursed).reduce((acc, exp) => {
            const driver = exp.username || 'Unbekannt';
            if (!acc[driver]) acc[driver] = 0;
            acc[driver] += exp.amount;
            return acc;
        }, {} as Record<string, number>);


        const driverList = Array.from(new Set([...Object.keys(settlementData), ...Object.keys(driverExpenses)])).sort();

        // Helper to calculate financials per driver
        const calculateFinancials = (driver: string) => {
            const data = settlementData[driver] || { count: 0, totalCash: 0, totalInvoice: 0, trips: [] };
            const myExpenses = driverExpenses[driver] || 0;

            const totalRevenue = data.totalCash + data.totalInvoice; // Gesamtumsatz (Bar + Rechnung) dieses Fahrers (nur unsettled trips)
            const driverEarnings = totalRevenue * DRIVER_SHARE_PERCENTAGE; // Verdienst

            // Was muss an den Chef?
            // Fahrer hat: totalCash (Geld in Tasche)
            // Fahrer behält: driverEarnings
            // Fahrer kriegt wieder: myExpenses (Auslagen)
            // Also: An Chef = totalCash - driverEarnings - myExpenses
            // (Wenn negativ, kriegt der Fahrer noch Geld vom Chef)
            const payToBoss = data.totalCash - driverEarnings - myExpenses;

            return {
                ...data,
                myExpenses,
                totalRevenue,
                driverEarnings,
                payToBoss
            };
        };


        if (settlementDriver) {
            // Detail view for one driver
            const financials = calculateFinancials(settlementDriver);
            const driverTrips = financials.trips.sort((a, b) => new Date(b.id.substring(0, 24)).getTime() - new Date(a.id.substring(0, 24)).getTime());

            // Filter expenses for this driver for display? 
            // The requirement didn't explicitly ask for an expense list, just the summary. But good to have.
            const myExpenseItems = expenses.filter(e => !e.isReimbursed && (e.username === settlementDriver));

            return (
                <>
                    <header>
                        <div className="header-content">
                            <button className="header-btn" onClick={() => setSettlementDriver(null)}>Zurück</button>
                            <h1 style={{ fontSize: '1.2rem', textAlign: 'center' }}>Abrechnung: {settlementDriver}</h1>
                            <button className="logout-btn" onClick={onLogout}>Logout</button>
                        </div>
                    </header>
                    <main className="boss-container">
                        <div className="list-container">
                            <div className="settlement-summary-card">
                                <div className="settlement-row">
                                    <span>Gesamtumsatz (offen):</span>
                                    <strong>{financials.totalRevenue.toFixed(2)} €</strong>
                                </div>
                                <div className="settlement-row">
                                    <span>Davon Bar (Kasse):</span>
                                    <span>{financials.totalCash.toFixed(2)} €</span>
                                </div>
                                <div className="settlement-row">
                                    <span>Davon Rechnung:</span>
                                    <span>{financials.totalInvoice.toFixed(2)} €</span>
                                </div>
                                <div className="settlement-row">
                                    <span>Offene Ausgaben:</span>
                                    <span>{financials.myExpenses.toFixed(2)} €</span>
                                </div>
                                <hr style={{ margin: '10px 0', borderColor: '#eee' }} />
                                <div className="settlement-row">
                                    <span><strong>Verdienst Fahrer (50%):</strong></span>
                                    <span style={{ color: 'green' }}><strong>{financials.driverEarnings.toFixed(2)} €</strong></span>
                                </div>
                                <div className="settlement-row large-sum">
                                    <span>An Chef (mir):</span>
                                    <strong style={{ color: financials.payToBoss >= 0 ? 'var(--primary-color)' : 'red' }}>
                                        {financials.payToBoss.toFixed(2)} €
                                        {financials.payToBoss < 0 && ' (Ausahlen!)'}
                                    </strong>
                                </div>
                            </div>

                            {myExpenseItems.length > 0 && (
                                <>
                                    <h3 style={{ marginTop: '20px' }}>Offene Ausgaben</h3>
                                    {myExpenseItems.map(exp => (
                                        <div key={exp.id} className="trip-card boss-trip-card" style={{ borderLeft: '4px solid orange' }}>
                                            <div className="card-header">
                                                <strong>{exp.description}</strong>
                                                <span>{exp.amount.toFixed(2)} €</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            <h3 style={{ marginTop: '20px' }}>Fahrt-Details ({driverTrips.length})</h3>
                            {driverTrips.length === 0 ? <p>Keine offenen Fahrten.</p> : (
                                driverTrips.map(trip => (
                                    <div key={trip.id} className="trip-card boss-trip-card">
                                        <div className="card-header">
                                            <div className="card-path">
                                                <span className="license-plate-badge">{trip.licensePlate}</span>
                                                <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                            </div>
                                            <span className="boss-trip-date">{formatTripDateForDisplay(trip.id)}</span>
                                        </div>
                                        <div className="card-details">
                                            <span className="detail-badge">{trip.payment.type === 'cash' ? 'Bar' : 'Rechnung'}</span>
                                            {trip.payment.type === 'cash' && trip.iCollectedPayment && <span className="detail-badge success-badge">Kassiert</span>}
                                            {trip.notes && <span className="detail-badge note-badge">📝 {trip.notes}</span>}
                                        </div>
                                        <div className={`card-payment ${trip.payment.type}`}>
                                            {trip.payment.amount.toFixed(2)} €
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </main>
                </>
            );
        }

        // Overview list of drivers
        return (
            <>
                <header>
                    <div className="header-content">
                        <button className="header-btn" onClick={() => setShowSettlements(false)}>Zurück</button>
                        <h1 style={{ fontSize: '1.2rem', textAlign: 'center' }}>Offene Abrechnungen</h1>
                        <button className="logout-btn" onClick={onLogout}>Logout</button>
                    </div>
                </header>
                <main className="boss-container">
                    <div className="list-container">
                        {driverList.length === 0 ? (
                            <div className="empty-state">
                                <h2>Alles erledigt!</h2>
                                <p>Keine offenen Fahrten oder Ausgaben.</p>
                            </div>
                        ) : (
                            driverList.map(driver => {
                                const fin = calculateFinancials(driver);
                                return (
                                    <div key={driver} className="trip-card boss-trip-card clickable" onClick={() => setSettlementDriver(driver)}>
                                        <div className="card-header">
                                            <strong>{driver}</strong>
                                            <span className="arrow-icon">➜</span>
                                        </div>
                                        <div className="settlement-mini-stats">
                                            <div>
                                                <small>Bar / Rech.</small>
                                                <div>{fin.totalCash.toFixed(0)} / {fin.totalInvoice.toFixed(0)} €</div>
                                            </div>
                                            <div>
                                                <small>Verdienst</small>
                                                <div style={{ color: 'green' }}>{fin.driverEarnings.toFixed(2)} €</div>
                                            </div>
                                            <div>
                                                <small>An Chef (mir)</small>
                                                <strong style={{ color: fin.payToBoss >= 0 ? 'var(--text-color)' : 'red' }}>
                                                    {fin.payToBoss.toFixed(2)} €
                                                </strong>
                                            </div>
                                        </div>
                                        {fin.myExpenses > 0 && (
                                            <div style={{ marginTop: '5px', fontSize: '0.85rem', color: 'orange' }}>
                                                ⚠️ {fin.myExpenses.toFixed(2)} € Ausgaben offen
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </main>
            </>
        );
    }

    if (detailView) {
        const { monthKey, filterType, filterValue } = detailView;
        const monthData = statsByMonth[monthKey];

        const getTitle = () => {
            let filterLabel = '';
            if (filterType === 'plate') filterLabel = `Fahrzeug ${filterValue}`;
            if (filterType === 'driver') filterLabel = `Fahrer ${filterValue}`;
            const baseTitle = `Details: ${formatMonth(monthKey)}`;
            return `${baseTitle}${filterLabel ? ` - ${filterLabel}` : ''}`;
        };

        const filteredTrips = monthData.trips.filter(trip => {
            if (filterType === 'plate') return trip.licensePlate === filterValue;
            if (filterType === 'driver') return (trip.username || 'Unbekannt') === filterValue;
            return true; // 'all' case
        });

        const filteredRentals = rentals.filter(r => {
            const d = new Date(r.start);
            if (isNaN(d.getTime())) return false;
            const rMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (rMonthKey !== monthKey) return false;
            if (filterType === 'plate') return r.licensePlate === filterValue;
            if (filterType === 'driver') return (r.username || 'Unbekannt') === filterValue;
            return true;
        });

        return (
            <>
                <header>
                    <div className="header-content">
                        <button className="header-btn" onClick={() => setDetailView(null)}>Zurück</button>
                        <h1 style={{ fontSize: '1.2rem', textAlign: 'center' }}>{getTitle()}</h1>
                        <button className="logout-btn" onClick={onLogout}>Logout</button>
                    </div>
                </header>
                <main className="boss-container">
                    <div className="list-container">
                        {filteredRentals.length > 0 && (
                            <>
                                <h3 style={{ margin: '0 0 10px', color: 'var(--primary-color)' }}>Verleihungen</h3>
                                {filteredRentals.map(r => (
                                    <div key={r.id} className="trip-card boss-trip-card">
                                        <div className="card-header">
                                            <div className="card-path">
                                                <span className="license-plate-badge">{r.licensePlate}</span>
                                                <strong>Vermietung</strong>
                                            </div>
                                            <span className="boss-trip-date">{formatDate(r.start)} – {formatDate(r.end)}</span>
                                        </div>
                                        <div className="card-details">
                                            {r.username && <span className="detail-badge">Erfasst von: {r.username}</span>}
                                        </div>
                                        <div className="card-payment rental">
                                            Umsatz: {Number(r.amount || 0).toFixed(2)} € (Verleih)
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {filteredTrips.length > 0 && (
                            <>
                                <h3 style={{ margin: '20px 0 10px', color: 'var(--primary-color)' }}>Fahrten</h3>
                                {filteredTrips.map(trip => (
                                    <div key={trip.id} className="trip-card boss-trip-card">
                                        <div className="card-header">
                                            <div className="card-path">
                                                <span className="license-plate-badge">{trip.licensePlate}</span>
                                                <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                            </div>
                                            <span className="boss-trip-date">{formatTripDateForDisplay(trip.id)}</span>
                                        </div>
                                        <div className="card-details">
                                            <span className="detail-badge">Fahrer: {trip.username || 'N/A'}</span>
                                        </div>
                                        <div className={`card-payment ${trip.payment.type}`}>
                                            Umsatz: {trip.payment.amount.toFixed(2)} € ({trip.payment.type === 'cash' ? 'Bar' : 'Rechnung'})
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {filteredTrips.length === 0 && filteredRentals.length === 0 && (
                            <div className="empty-state">
                                <h2>Keine Fahrten oder Verleihungen gefunden</h2>
                                <p>Für diese Auswahl wurden keine Umsätze erfasst.</p>
                            </div>
                        )}
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <ManagePlatesModal
                isOpen={isManagePlatesModalOpen}
                onClose={() => setIsManagePlatesModalOpen(false)}
                plates={plates}
                onAdd={onAddPlate}
                onDelete={onDeletePlate}
            />
            <CreateUserModal
                isOpen={isCreateUserModalOpen}
                onClose={() => setIsCreateUserModalOpen(false)}
                onCreate={onCreateUser}
            />
            <AssignTripModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} drivers={drivers} onTripAssigned={handleTripAssigned} />
            <header>
                <div className="header-content">
                    <h1>Chef-Dashboard</h1>
                    <div className="header-actions">
                        <button className="header-btn" onClick={() => setShowSettlements(true)}>Abrechnungen</button>
                        <button className="header-btn" onClick={() => setShowRentals(true)}>Autoverleih</button>
                        <button className="header-btn" onClick={() => setIsManagePlatesModalOpen(true)}>Kennzeichen</button>
                        <button className="header-btn" onClick={() => setIsCreateUserModalOpen(true)}>Fahrer anlegen</button>
                        {onSwitchToUser && (
                            <button className="header-btn fc-koeln" onClick={onSwitchToUser}>Fahreransicht</button>
                        )}
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
                            <div key={monthKey} className="boss-month-section">
                                <div className="boss-month-header" onClick={() => setDetailView({ monthKey, filterType: 'all', filterValue: 'all' })} role="button" tabIndex={0}>
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
                                                    <th>Umsatz (Anzahl)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedPlates.map(plate => (
                                                    <tr key={plate} onClick={() => setDetailView({ monthKey, filterType: 'plate', filterValue: plate })}>
                                                        <td>{plate}</td>
                                                        <td>{monthData.byPlate[plate].revenue.toFixed(2)} € ({monthData.byPlate[plate].count})</td>
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
                                                    <th>Umsatz (Anzahl)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedDrivers.map(driver => (
                                                    <tr key={driver} onClick={() => setDetailView({ monthKey, filterType: 'driver', filterValue: driver })}>
                                                        <td>{driver}</td>
                                                        <td>{monthData.byDriver[driver].revenue.toFixed(2)} € ({monthData.byDriver[driver].count})</td>
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
            <Toast message={toastMessage} onClear={() => setToastMessage('')} />
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
const App = ({ username, initialData, onLogout, plates, onSwitchToBoss, canSwitchRoles, onRentalAdded }: {
    username: string,
    initialData: { trips: Trip[], expenses: Expense[], assignedTrips: AssignedTrip[], rentals?: CarRental[] },
    onLogout: () => void,
    plates: string[],
    onSwitchToBoss?: () => void,
    canSwitchRoles?: boolean,
    onRentalAdded: (rental: CarRental) => void
}) => {
    const [trips, setTrips] = useState<Trip[]>(initialData.trips);
    const [expenses, setExpenses] = useState<Expense[]>(initialData.expenses);
    const [assignedTrips, setAssignedTrips] = useState<AssignedTrip[]>(initialData.assignedTrips);
    const [rentals, setRentals] = useState<CarRental[]>(initialData.rentals || []);
    const [isTripModalOpen, setIsTripModalOpen] = useState(false);
    const [tripToStart, setTripToStart] = useState<AssignedTrip | null>(null);
    const [tripToEdit, setTripToEdit] = useState<Trip | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    const [isRentModalOpen, setIsRentModalOpen] = useState(false);
    const [activeView, setActiveView] = useState<'trips' | 'expenses' | 'stats'>('trips');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [filterDestination, setFilterDestination] = useState('');
    const [filterLicensePlate, setFilterLicensePlate] = useState('');
    const [confirmModalProps, setConfirmModalProps] = useState({
        title: '',
        message: '',
        onConfirm: () => { },
        confirmButtonText: 'OK',
        isDestructive: false,
    });

    const handleSaveRental = async ({ startISO, endISO, amount, licensePlate }: { startISO: string, endISO: string, amount: number, licensePlate: string }) => {
        if (!GOOGLE_SHEET_URL) throw new Error('App ist nicht konfiguriert.');
        try {
            // Update UI immediately
            const newRental: CarRental = {
                id: new Date().toISOString() + Math.random().toString(36).substr(2, 9),
                username,
                licensePlate,
                start: startISO,
                end: endISO,
                amount,
            };
            setRentals(prev => [newRental, ...prev]);
            // Ensure global app data also reflects the new rental (persists across role switches)
            onRentalAdded(newRental);
            // Queue sync
            const ok = await enqueueOp({ id: newRental.id, type: 'car_rental', username, payload: { start: startISO, end: endISO, amount, licensePlate } });
            setToastMessage(ok ? '✅ Verleih gespeichert!' : '📥 Offline gespeichert – wird synchronisiert.');
        } catch (error: any) {
            setToastMessage(`❌ Fehler: ${error.message || 'Speichern fehlgeschlagen.'}`);
            throw error;
        }
    };

    const syncTrip = async (trip: Trip) => {
        try {
            markPending('trip', trip.id);
            const ok = await enqueueOp({ id: trip.id, type: 'trip', username, payload: { ...trip } });
            if (!ok) setToastMessage('📥 Fahrt offline gespeichert – wird synchronisiert.');
        } catch (error) {
            console.error("Failed to queue trip:", error);
        }
    };

    const syncExpense = async (expense: Expense) => {
        try {
            const ok = await enqueueOp({ id: expense.id, type: 'expense', username, payload: { ...expense } });
            if (!ok) setToastMessage('📥 Ausgabe offline gespeichert – wird synchronisiert.');
        } catch (error) {
            console.error("Failed to queue expense:", error);
        }
    };

    const updateAssignedTripStatus = async (id: string, status: 'accepted' | 'declined') => {
        setAssignedTrips(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        setToastMessage(status === 'accepted' ? '✅ Fahrt akzeptiert!' : 'Fahrt abgelehnt.');
        try {
            const ok = await enqueueOp({ id, type: 'update_assigned_trip_status', username, payload: { id, status } });
            if (!ok) setToastMessage('📥 Status offline gespeichert – wird synchronisiert.');
        } catch (error) {
            console.error("Failed to queue trip status:", error);
        }
    };

    const handleStartAssignedTrip = (assignedTrip: AssignedTrip) => {
        setTripToStart(assignedTrip);
        setTripToEdit(null);
        setIsTripModalOpen(true);
    };

    const handleOpenEditModal = (trip: Trip) => {
        setTripToStart(null);
        setTripToEdit(trip);
        setIsTripModalOpen(true);
    };

    const handleCloseTripModal = () => {
        setIsTripModalOpen(false);
        setTripToStart(null);
        setTripToEdit(null);
    };

    const handleSaveTrip = async (newTripData: Omit<Trip, 'id' | 'isSettled' | 'username'>) => {
        if (tripToEdit) {
            // Edit logic
            const updatedTrip: Trip = {
                ...tripToEdit,
                ...newTripData,
                wurdeBearbeitet: true,
                bearbeitungsdatum: new Date().toISOString(),
                originalStart: tripToEdit.start,
                originalZiel: tripToEdit.destination,
                originalBetrag: tripToEdit.payment.amount,
                originalZahlungsart: tripToEdit.payment.type,
                originalFahreranzahl: tripToEdit.numberOfDrivers,
                originalIchHabeKassiert: tripToEdit.iCollectedPayment,
                originalNotizen: tripToEdit.notes || "",
                syncStatus: 'pending',
            };
            setTrips(prevTrips => prevTrips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
            await syncTrip(updatedTrip);
            setToastMessage('✅ Fahrt erfolgreich bearbeitet!');
        } else {
            // Add logic
            const newTrip: Trip = {
                id: new Date().toISOString() + Math.random().toString(36).substr(2, 9),
                ...newTripData, isSettled: false, wurdeBearbeitet: false,
                syncStatus: 'pending',
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
        }
    };

    const handleSettleTrip = (id: string) => {
        let settledTrip: Trip | undefined;
        const updatedTrips = trips.map(trip => {
            if (trip.id === id) {
                settledTrip = { ...trip, isSettled: true, syncStatus: 'pending' };
                return settledTrip;
            }
            return trip;
        });
        setTrips(updatedTrips);
        if (settledTrip) {
            syncTrip(settledTrip);
            setToastMessage('✅ Fahrt wurde abgerechnet.');
        }
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
        if (reimbursedExpense) {
            syncExpense(reimbursedExpense);
            setToastMessage('✅ Ausgabe wurde erstattet.');
        }
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
            const ok = await enqueueOp({ id: new Date().toISOString() + Math.random().toString(36).substr(2, 9), type: 'support_ticket', username, payload: { message, attachedTripId: attachedTripId || '' } });
            setToastMessage(ok ? '✅ Support-Ticket erfolgreich gesendet!' : '📥 Ticket offline gespeichert – wird synchronisiert.');
            setIsSupportModalOpen(false);
        } catch (error: any) {
            console.error("Failed to queue support ticket:", error);
            setToastMessage(`❌ Fehler: ${error.message || 'Ticket konnte nicht gesendet werden.'}`);
        }
    };

    // Persist only pending items locally to avoid resurrecting deleted server data
    useEffect(() => {
        const pendingTrips = trips.filter(t => isPending('trip', String(t.id)));
        const pendingExpenses = expenses.filter(e => isPending('expense', String(e.id)));
        const pendingRentals = rentals.filter(r => isPending('car_rental', String(r.id)));
        persistLocalData(username, { trips: pendingTrips, expenses: pendingExpenses, rentals: pendingRentals, assignedTrips: [] });
    }, [username, trips, expenses, rentals]);

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

    const openTrips = useMemo(() => trips.filter(trip => !trip.isSettled).sort((a, b) => new Date(b.id.substring(0, 24)).getTime() - new Date(a.id.substring(0, 24)).getTime()), [trips]);
    const openExpensesList = useMemo(() => expenses.filter(expense => !expense.isReimbursed), [expenses]);
    const nowTs = Date.now();
    const activeRentals = useMemo(() => rentals.filter(r => {
        const startTs = new Date(r.start).getTime();
        const endTs = new Date(r.end).getTime();
        return !isNaN(startTs) && !isNaN(endTs) && startTs <= nowTs && endTs >= nowTs;
    }), [rentals, nowTs]);
    const upcomingRentals = useMemo(() => rentals.filter(r => {
        const startTs = new Date(r.start).getTime();
        return !isNaN(startTs) && startTs > nowTs; // alle zukünftigen Verleihungen
    }), [rentals, nowTs]);

    const filteredOpenTrips = useMemo(() => {
        return openTrips.filter(trip => {
            const destinationMatch = filterDestination
                ? trip.destination.toLowerCase().includes(filterDestination.toLowerCase())
                : true;
            const plateMatch = filterLicensePlate
                ? trip.licensePlate === filterLicensePlate
                : true;
            return destinationMatch && plateMatch;
        });
    }, [openTrips, filterDestination, filterLicensePlate]);

    // Re-render when sync status changes globally
    const [syncStatusVersion, setSyncStatusVersion] = useState(0);
    useEffect(() => {
        const handler = () => setSyncStatusVersion(v => v + 1);
        window.addEventListener('fahrtenbuch-sync-status-changed', handler);
        return () => window.removeEventListener('fahrtenbuch-sync-status-changed', handler);
    }, []);

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
                let lastDateHeader: string | null = null;
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
                                    )
                                })}
                            </div>
                        )}

                        {openTrips.length > 0 && (
                            <div className="filter-container">
                                <div className="form-group">
                                    <label htmlFor="filter-destination">Nach Ziel filtern</label>
                                    <input
                                        type="text"
                                        id="filter-destination"
                                        placeholder="Zielort eingeben..."
                                        value={filterDestination}
                                        onChange={(e) => setFilterDestination(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="filter-plate">Nach Kennzeichen filtern</label>
                                    <select
                                        id="filter-plate"
                                        value={filterLicensePlate}
                                        onChange={(e) => setFilterLicensePlate(e.target.value)}
                                    >
                                        <option value="">Alle Kennzeichen</option>
                                        {plates.map(lp => (
                                            <option key={lp} value={lp}>{lp}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {openTrips.length === 0 && visibleAssignedTrips.length === 0 ? (
                            <div className="empty-state">
                                <h2>Willkommen, {username}!</h2>
                                <p>Keine offenen Fahrten. Fügen Sie eine neue Fahrt über das '+' Symbol hinzu oder schauen Sie ins Archiv.</p>
                            </div>
                        ) : filteredOpenTrips.length === 0 ? (
                            <div className="empty-state">
                                <h2>Keine Fahrten gefunden</h2>
                                <p>Ihre Filterkriterien ergaben keine Treffer. Bitte passen Sie die Filter an.</p>
                            </div>
                        ) : (
                            <div className="list-container">
                                {filteredOpenTrips.map(trip => {
                                    const dateHeader = getRelativeDateHeader(trip.id);
                                    const showDateHeader = dateHeader !== lastDateHeader;
                                    lastDateHeader = dateHeader;
                                    const pending = isPending('trip', trip.id);
                                    return (
                                        <React.Fragment key={trip.id}>
                                            {showDateHeader && <h3 className="date-header">{dateHeader}</h3>}
                                            <div className="trip-card">
                                                <div className="card-header">
                                                    <div className="card-path">
                                                        <span className="license-plate-badge">{trip.licensePlate}</span>
                                                        <span className={`sync-dot ${pending ? 'pending' : 'synced'}`} aria-label={pending ? 'Nicht synchronisiert' : 'Synchronisiert'}></span>
                                                        <strong>{trip.start}</strong> → <strong>{trip.destination}</strong>
                                                    </div>
                                                    <span className="trip-date">{formatTripDateForDisplay(trip.id)}</span>
                                                </div>
                                                <div className="card-details">
                                                    {trip.wurdeBearbeitet && (<span className="edited-badge">Bearbeitet ✔</span>)}
                                                    {trip.numberOfDrivers > 1 && (<span className="detail-badge">Gruppenfahrt ({trip.numberOfDrivers} Fahrer)</span>)}
                                                    <span className="detail-badge">{trip.iCollectedPayment ? 'Bezahlung erhalten' : 'Bezahlung durch Kollegen'}</span>
                                                </div>
                                                {trip.notes && (<div className="card-notes"><p>{trip.notes}</p></div>)}
                                                <div className={`card-payment ${trip.payment.type}`}>
                                                    {trip.payment.type === 'cash' ? `Bar erhalten: ${trip.payment.amount.toFixed(2)} €` : `Per Rechnung: ${trip.payment.amount.toFixed(2)} €`}
                                                </div>
                                                <div className="card-actions">
                                                    {!trip.wurdeBearbeitet && (<button onClick={() => handleOpenEditModal(trip)} className="edit-btn">Bearbeiten</button>)}
                                                    <button onClick={() => handleSettleTrip(trip.id)} className="settle-btn">Mit Chef abrechnen</button>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                        <button className="add-fab" onClick={() => { setTripToStart(null); setTripToEdit(null); setIsTripModalOpen(true); }} aria-label="Fahrt hinzufügen">+</button>
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
                        {canSwitchRoles && onSwitchToBoss && (
                            <button className="header-btn fc-koeln" onClick={onSwitchToBoss}>Chefansicht</button>
                        )}
                        {username.toLowerCase() === 'franco' && (
                            <button className="header-btn" onClick={() => setIsRentModalOpen(true)}>Auto verleihen</button>
                        )}
                        <button className="header-btn" onClick={() => setIsArchiveOpen(true)}>Archiv</button>
                        <button className="header-btn" onClick={() => setIsSupportModalOpen(true)}>Support</button>
                        <button className="logout-btn" onClick={onLogout}>Logout</button>
                    </div>
                </div>
            </header>
            {(activeRentals.length > 0 || upcomingRentals.length > 0) && (
                <div className="assigned-trips-section" style={{ paddingTop: '0.5rem' }}>
                    {activeRentals.length > 0 && (
                        <div className="card-details" style={{ marginBottom: '0.5rem' }}>
                            <span className="detail-badge" style={{ background: '#e0ffe0' }}>Aktiv verliehen:</span>
                            {activeRentals.map(r => (
                                <span key={r.id} className="license-plate-badge" style={{ marginLeft: '0.5rem' }}>
                                    {r.licensePlate} bis {new Date(r.end).toLocaleDateString('de-DE')}
                                </span>
                            ))}
                        </div>
                    )}
                    {upcomingRentals.length > 0 && (
                        <div className="card-details">
                            <span className="detail-badge" style={{ background: '#fff3cd' }}>Bevorstehend:</span>
                            {upcomingRentals.map(r => (
                                <span key={r.id} className="license-plate-badge" style={{ marginLeft: '0.5rem' }}>
                                    {r.licensePlate} ab {new Date(r.start).toLocaleDateString('de-DE')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <main className="app-container">{renderContent()}</main>
            <nav className="bottom-nav">
                <button className={`nav-btn ${activeView === 'trips' ? 'active' : ''}`} onClick={() => setActiveView('trips')}>Fahrten</button>
                <button className={`nav-btn ${activeView === 'expenses' ? 'active' : ''}`} onClick={() => setActiveView('expenses')}>Ausgaben</button>
                <button className={`nav-btn ${activeView === 'stats' ? 'active' : ''}`} onClick={() => setActiveView('stats')}>Statistik</button>
            </nav>
            <TripFormModal
                isOpen={isTripModalOpen}
                onClose={handleCloseTripModal}
                onSave={handleSaveTrip}
                initialData={tripToStart || undefined}
                tripToEdit={tripToEdit}
                plates={plates}
            />
            <AddExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onSave={handleAddExpense} />
            <RentCarModal isOpen={isRentModalOpen} onClose={() => setIsRentModalOpen(false)} onSave={handleSaveRental} plates={plates} />
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

// --- Offline Sync Helpers ---
type SyncOpType = 'trip' | 'expense' | 'car_rental' | 'update_assigned_trip_status' | 'support_ticket' | 'add_plate' | 'delete_plate';
interface SyncOp { id: string; type: SyncOpType; payload: any; username: string; }
const SYNC_QUEUE_KEY = 'fahrtenbuch-sync-queue';
const SYNC_STATUS_KEY = 'fahrtenbuch-sync-status';

const readQueue = (): SyncOp[] => {
    try {
        const raw = localStorage.getItem(SYNC_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
};

const writeQueue = (queue: SyncOp[]) => {
    try { localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue)); } catch { }
};

type SyncStatusType = 'trip' | 'expense' | 'car_rental';
const readSyncStatus = (): Record<SyncStatusType, Record<string, 'pending' | 'synced'>> => {
    try {
        const raw = localStorage.getItem(SYNC_STATUS_KEY);
        return raw ? JSON.parse(raw) : { trip: {}, expense: {}, car_rental: {} };
    } catch { return { trip: {}, expense: {}, car_rental: {} }; }
};

const writeSyncStatus = (status: Record<SyncStatusType, Record<string, 'pending' | 'synced'>>) => {
    try {
        localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
        window.dispatchEvent(new Event('fahrtenbuch-sync-status-changed'));
    } catch { }
};

const markPending = (type: SyncStatusType, id: string) => {
    const status = readSyncStatus();
    status[type][id] = 'pending';
    writeSyncStatus(status);
};

const markSynced = (type: SyncStatusType, id: string) => {
    const status = readSyncStatus();
    status[type][id] = 'synced';
    writeSyncStatus(status);
};

const isPending = (type: SyncStatusType, id: string) => {
    const status = readSyncStatus();
    return status[type][id] === 'pending';
};

const enqueueOp = async (op: SyncOp): Promise<boolean> => {
    const queue = readQueue();
    queue.push(op);
    writeQueue(queue);
    // Try to send immediately
    return await drainQueueOne(op.id);
};

const drainQueueOne = async (opId: string): Promise<boolean> => {
    let queue = readQueue();
    const idx = queue.findIndex(q => q.id === opId);
    if (idx === -1) return true;
    const op = queue[idx];
    try {
        const resp = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ dataType: op.type, username: op.username, ...op.payload }),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        if (json.status === 'error') throw new Error(json.message || 'Serverfehler');
        // Remove from queue on success
        queue.splice(idx, 1);
        writeQueue(queue);
        // Mark sync status when applicable
        if (op.type === 'trip' && op.payload && op.payload.id) {
            markSynced('trip', String(op.payload.id));
        }
        return true;
    } catch {
        // Keep in queue for later retry
        return false;
    }
};

const drainQueue = async () => {
    let queue = readQueue();
    if (!queue.length) return;
    const remaining: SyncOp[] = [];
    for (const op of queue) {
        try {
            const ok = await drainQueueOne(op.id);
            if (!ok) remaining.push(op);
        } catch { remaining.push(op); }
    }
    writeQueue(remaining);
};

const persistLocalData = (username: string, data: { trips?: Trip[]; expenses?: Expense[]; assignedTrips?: AssignedTrip[]; rentals?: CarRental[]; plates?: string[] }) => {
    try {
        const key = `fahrtenbuch-local-${username}`;
        const raw = localStorage.getItem(key);
        const prev = raw ? JSON.parse(raw) : {};
        const merged = { ...prev, ...data };
        localStorage.setItem(key, JSON.stringify(merged));
    } catch { }
};

const readLocalData = (username: string): { trips?: Trip[]; expenses?: Expense[]; assignedTrips?: AssignedTrip[]; rentals?: CarRental[]; plates?: string[] } => {
    try {
        const raw = localStorage.getItem(`fahrtenbuch-local-${username}`);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
};

const AppContainer = () => {
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [primaryUser, setPrimaryUser] = useState<string | null>(null);
    const [appData, setAppData] = useState<{ trips: Trip[], expenses: Expense[], assignedTrips: AssignedTrip[], drivers: string[], plates: string[], rentals?: CarRental[] }>({ trips: [], expenses: [], assignedTrips: [], drivers: [], plates: [], rentals: [] });
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const [isBookingMode, setIsBookingMode] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('booking') === 'true') {
            setIsBookingMode(true);
            setIsDataLoading(false);
            return;
        }

        const loggedInUser = localStorage.getItem('fahrtenbuch-currentUser');
        const savedPrimaryUser = localStorage.getItem('fahrtenbuch-primaryUser');
        if (savedPrimaryUser) {
            setPrimaryUser(savedPrimaryUser);
        }
        if (loggedInUser) {
            setCurrentUser(loggedInUser);
            if (!savedPrimaryUser) setPrimaryUser(loggedInUser);
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

                const baseData = {
                    trips: (result.trips || []).filter((t: any) => t && t.id).map((t: any) => ({ ...t, isSettled: t.isSettled || false, wurdeBearbeitet: t.wurdeBearbeitet === true })),
                    expenses: (result.expenses || []).filter((e: any) => e && e.id).map((e: any) => ({ ...e, isReimbursed: e.isReimbursed || false })),
                    assignedTrips: (result.assignedTrips || []).filter((t: any) => t && t.id),
                    drivers: result.drivers || [],
                    plates: result.plates || [],
                    rentals: Array.isArray(result.rentals) ? result.rentals.filter((r: any) => r && r.licensePlate && r.start && r.end).map((r: any) => ({
                        id: r.id || new Date().toISOString() + Math.random().toString(36).substr(2, 9),
                        username: r.username,
                        licensePlate: r.licensePlate,
                        start: r.start,
                        end: r.end,
                        amount: Number(r.amount) || 0,
                    })) : [],
                };

                // Try to fetch rentals; if endpoint not available, keep empty array gracefully
                let rentals: CarRental[] = [];
                try {
                    const rResp = await fetch(`${GOOGLE_SHEET_URL}?action=getCarRentals`);
                    if (rResp.ok) {
                        const rJson = await rResp.json();
                        if (rJson.status !== 'error' && Array.isArray(rJson.rentals)) {
                            rentals = rJson.rentals.filter((r: any) => r && r.licensePlate && r.start && r.end).map((r: any) => ({
                                id: r.id || new Date().toISOString() + Math.random().toString(36).substr(2, 9),
                                username: r.username,
                                licensePlate: r.licensePlate,
                                start: r.start,
                                end: r.end,
                                amount: Number(r.amount) || 0,
                            }));
                        }
                    }
                } catch { /* optional endpoint; ignore errors */ }

                // Merge with locally persisted offline data (only keep pending overlays)
                const local = readLocalData(currentUser);
                const overlayPending = <T extends { id: string }>(remote: T[] = [], localArr: T[] = [], type: SyncStatusType) => {
                    const remoteById = new Map(remote.map(i => [i.id, i]));
                    const pendingLocals = (localArr || []).filter((item: any) => item && item.id && isPending(type, String(item.id)));
                    const merged: T[] = [...remote];
                    for (const l of pendingLocals as T[]) {
                        if (!remoteById.has(l.id)) merged.push(l);
                    }
                    return merged;
                };
                const mergedTrips = overlayPending(baseData.trips || [], (local.trips || []) as Trip[], 'trip');
                const mergedExpenses = overlayPending(baseData.expenses || [], (local.expenses || []) as Expense[], 'expense');
                // Assigned trips are authoritative from server; do not overlay locals to avoid ghosts
                const mergedAssigned = baseData.assignedTrips || [];
                const mergedRentals = overlayPending(rentals || [], (local.rentals || []) as CarRental[], 'car_rental');
                const mergedPlates = Array.from(new Set([...(baseData.plates || []), ...((local.plates || []) as string[])]));

                setAppData({ ...baseData, rentals: mergedRentals, trips: mergedTrips, expenses: mergedExpenses, assignedTrips: mergedAssigned, plates: mergedPlates });
                // Kick off background sync of any queued operations
                drainQueue();

            } catch (error: any) {
                console.error("Error loading data from Google Sheet:", error);
                alert(`Fehler beim Laden der Daten: ${error.message}`);
            } finally {
                setIsDataLoading(false);
            }
        };
        fetchData();
        const onlineHandler = () => { drainQueue(); };
        window.addEventListener('online', onlineHandler);
        const interval = setInterval(drainQueue, 30000);
        return () => { window.removeEventListener('online', onlineHandler); clearInterval(interval); };
    }, [currentUser]);

    const handleAddPlate = async (plate: string) => {
        if (!currentUser) throw new Error("Nicht angemeldet.");
        if (appData.plates.some(p => p.toLowerCase() === plate.toLowerCase())) {
            throw new Error("Dieses Kennzeichen existiert bereits.");
        }

        setAppData(prev => ({ ...prev, plates: [...prev.plates, plate] }));
        persistLocalData(currentUser, { plates: [...appData.plates, plate] });
        const op: SyncOp = { id: new Date().toISOString() + Math.random().toString(36).substr(2, 9), type: 'add_plate', username: currentUser, payload: { plate } };
        const ok = await enqueueOp(op);
        setToastMessage(ok ? '✅ Kennzeichen hinzugefügt!' : '📥 Offline gespeichert – wird synchronisiert.');
    };

    const handleDeletePlate = async (plate: string) => {
        if (!currentUser) throw new Error("Nicht angemeldet.");

        setAppData(prev => ({ ...prev, plates: prev.plates.filter(p => p !== plate) }));
        persistLocalData(currentUser, { plates: appData.plates.filter(p => p !== plate) });
        const op: SyncOp = { id: new Date().toISOString() + Math.random().toString(36).substr(2, 9), type: 'delete_plate', username: currentUser, payload: { plate } };
        const ok = await enqueueOp(op);
        setToastMessage(ok ? '✅ Kennzeichen gelöscht!' : '📥 Offline gespeichert – wird synchronisiert.');
    };

    const handleLogin = async (username: string, password: string) => {
        if (!GOOGLE_SHEET_URL) throw new Error("App ist nicht konfiguriert.");

        const response = await fetch(`${GOOGLE_SHEET_URL}?action=login&user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}`);
        if (!response.ok) throw new Error("Kommunikationsfehler mit dem Server.");

        const result = await response.json();
        if (result.status === 'error' || !result.loggedIn) {
            throw new Error(result.message || 'Anmeldung fehlgeschlagen.');
        }

        localStorage.setItem('fahrtenbuch-currentUser', username);
        localStorage.setItem('fahrtenbuch-primaryUser', username);
        setPrimaryUser(username);
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
        localStorage.removeItem('fahrtenbuch-primaryUser');
        setPrimaryUser(null);
        setCurrentUser(null);
        setAppData({ trips: [], expenses: [], assignedTrips: [], drivers: [], plates: [], rentals: [] });
        setAuthView('login');
    };

    const canSwitchRoles = ['franco', 'angelo', 'chef'].includes(primaryUser?.toLowerCase() || '');
    const switchToBossView = () => {
        if (!canSwitchRoles) return;
        localStorage.setItem('fahrtenbuch-currentUser', 'chef');
        setCurrentUser('chef');
    };
    const switchToUserView = () => {
        if (!primaryUser) return;
        localStorage.setItem('fahrtenbuch-currentUser', primaryUser);
        setCurrentUser(primaryUser);
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
        return <BossView
            trips={appData.trips}
            expenses={appData.expenses}
            rentals={appData.rentals || []}
            drivers={appData.drivers}
            initialAssignedTrips={appData.assignedTrips}
            onLogout={handleLogout}
            plates={appData.plates}
            onAddPlate={handleAddPlate}
            onDeletePlate={handleDeletePlate}
            onSwitchToUser={switchToUserView}
            onCreateUser={handleRegister} // Using existing handleRegister logic for admin user creation
        />;
    }

    return <App
        username={currentUser}
        initialData={appData}
        onLogout={handleLogout}
        plates={appData.plates}
        onSwitchToBoss={switchToBossView}
        canSwitchRoles={canSwitchRoles}
        onRentalAdded={(r) => setAppData(prev => ({ ...prev, rentals: [r, ...(prev.rentals || [])] }))}
    />;
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<AppContainer />);
}
