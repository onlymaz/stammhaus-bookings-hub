export type Language = 'de' | 'en';

export const translations = {
  de: {
    // Public booking page
    booking: {
      title: 'Tischreservierung',
      subtitle: 'Reservieren Sie Ihren Tisch im Stammhaus',
      selectDate: 'Datum wählen',
      selectTime: 'Uhrzeit wählen',
      guests: 'Anzahl Gäste',
      guest: 'Gast',
      guestsPlural: 'Gäste',
      yourDetails: 'Ihre Daten',
      name: 'Name',
      namePlaceholder: 'Ihr vollständiger Name',
      phone: 'Telefon',
      phonePlaceholder: '+43 660 123 4567',
      email: 'E-Mail (optional)',
      emailPlaceholder: 'ihre@email.at',
      specialRequests: 'Besondere Wünsche',
      specialRequestsPlaceholder: 'Allergien, Kinderstuhl, etc.',
      reserveTable: 'Tisch reservieren',
      reserving: 'Reservierung wird bearbeitet...',
      noSlotsAvailable: 'Keine Zeitfenster verfügbar',
      closed: 'Geschlossen',
      confirmation: {
        title: 'Reservierung bestätigt!',
        subtitle: 'Vielen Dank für Ihre Reservierung',
        details: 'Reservierungsdetails',
        date: 'Datum',
        time: 'Uhrzeit',
        guests: 'Gäste',
        confirmationSent: 'Eine Bestätigung wurde an Ihre E-Mail gesendet.',
        backToHome: 'Zurück zur Startseite',
        newReservation: 'Neue Reservierung',
      },
      errors: {
        nameRequired: 'Name ist erforderlich',
        phoneRequired: 'Telefonnummer ist erforderlich',
        invalidEmail: 'Ungültige E-Mail-Adresse',
        dateRequired: 'Bitte wählen Sie ein Datum',
        timeRequired: 'Bitte wählen Sie eine Uhrzeit',
        guestsRequired: 'Bitte wählen Sie die Anzahl der Gäste',
        bookingFailed: 'Reservierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      },
    },
    // Days of week
    days: {
      0: 'Sonntag',
      1: 'Montag',
      2: 'Dienstag',
      3: 'Mittwoch',
      4: 'Donnerstag',
      5: 'Freitag',
      6: 'Samstag',
    },
    daysShort: {
      0: 'So',
      1: 'Mo',
      2: 'Di',
      3: 'Mi',
      4: 'Do',
      5: 'Fr',
      6: 'Sa',
    },
    months: {
      0: 'Januar',
      1: 'Februar',
      2: 'März',
      3: 'April',
      4: 'Mai',
      5: 'Juni',
      6: 'Juli',
      7: 'August',
      8: 'September',
      9: 'Oktober',
      10: 'November',
      11: 'Dezember',
    },
    // Common
    common: {
      loading: 'Laden...',
      error: 'Fehler',
      success: 'Erfolg',
      cancel: 'Abbrechen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      close: 'Schließen',
      confirm: 'Bestätigen',
      back: 'Zurück',
      next: 'Weiter',
      today: 'Heute',
      tomorrow: 'Morgen',
      person: 'Person',
      people: 'Personen',
    },
  },
  en: {
    // Public booking page
    booking: {
      title: 'Table Reservation',
      subtitle: 'Reserve your table at Stammhaus',
      selectDate: 'Select Date',
      selectTime: 'Select Time',
      guests: 'Number of Guests',
      guest: 'Guest',
      guestsPlural: 'Guests',
      yourDetails: 'Your Details',
      name: 'Name',
      namePlaceholder: 'Your full name',
      phone: 'Phone',
      phonePlaceholder: '+43 660 123 4567',
      email: 'Email (optional)',
      emailPlaceholder: 'your@email.com',
      specialRequests: 'Special Requests',
      specialRequestsPlaceholder: 'Allergies, high chair, etc.',
      reserveTable: 'Reserve Table',
      reserving: 'Processing reservation...',
      noSlotsAvailable: 'No time slots available',
      closed: 'Closed',
      confirmation: {
        title: 'Reservation Confirmed!',
        subtitle: 'Thank you for your reservation',
        details: 'Reservation Details',
        date: 'Date',
        time: 'Time',
        guests: 'Guests',
        confirmationSent: 'A confirmation has been sent to your email.',
        backToHome: 'Back to Home',
        newReservation: 'New Reservation',
      },
      errors: {
        nameRequired: 'Name is required',
        phoneRequired: 'Phone number is required',
        invalidEmail: 'Invalid email address',
        dateRequired: 'Please select a date',
        timeRequired: 'Please select a time',
        guestsRequired: 'Please select number of guests',
        bookingFailed: 'Booking failed. Please try again.',
      },
    },
    // Days of week
    days: {
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
    },
    daysShort: {
      0: 'Sun',
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
    },
    months: {
      0: 'January',
      1: 'February',
      2: 'March',
      3: 'April',
      4: 'May',
      5: 'June',
      6: 'July',
      7: 'August',
      8: 'September',
      9: 'October',
      10: 'November',
      11: 'December',
    },
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      today: 'Today',
      tomorrow: 'Tomorrow',
      person: 'person',
      people: 'people',
    },
  },
} as const;

// Create a type that represents the structure of translations
type TranslationStructure = {
  booking: {
    title: string;
    subtitle: string;
    selectDate: string;
    selectTime: string;
    guests: string;
    guest: string;
    guestsPlural: string;
    yourDetails: string;
    name: string;
    namePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    specialRequests: string;
    specialRequestsPlaceholder: string;
    reserveTable: string;
    reserving: string;
    noSlotsAvailable: string;
    closed: string;
    confirmation: {
      title: string;
      subtitle: string;
      details: string;
      date: string;
      time: string;
      guests: string;
      confirmationSent: string;
      backToHome: string;
      newReservation: string;
    };
    errors: {
      nameRequired: string;
      phoneRequired: string;
      invalidEmail: string;
      dateRequired: string;
      timeRequired: string;
      guestsRequired: string;
      bookingFailed: string;
    };
  };
  days: Record<number, string>;
  daysShort: Record<number, string>;
  months: Record<number, string>;
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    confirm: string;
    back: string;
    next: string;
    today: string;
    tomorrow: string;
    person: string;
    people: string;
  };
};

export type Translations = TranslationStructure;

export function getTranslation(lang: Language): Translations {
  return translations[lang] as Translations;
}
