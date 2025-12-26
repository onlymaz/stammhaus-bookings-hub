export type ReservationStatus = 'new' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type ReservationSource = 'website' | 'phone';
export type AppRole = 'admin' | 'staff';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  customer_id: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  source: ReservationSource;
  status: ReservationStatus;
  notes?: string | null;
  special_requests?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface Table {
  id: string;
  table_number: string;
  seats: number;
  is_active: boolean;
  created_at: string;
}

export interface OperatingHours {
  id: string;
  day_of_week: number;
  is_closed: boolean;
  lunch_start?: string | null;
  lunch_end?: string | null;
  dinner_start?: string | null;
  dinner_end?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapacitySettings {
  id: string;
  max_guests_per_slot: number;
  max_tables_per_slot: number;
  total_restaurant_capacity: number;
  slot_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  blocked_date: string;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  reservation_id?: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  remainingGuests: number;
  remainingTables: number;
}

export interface DayAvailability {
  date: string;
  isOpen: boolean;
  slots: TimeSlot[];
}

export interface BookingFormData {
  date: Date | null;
  time: string | null;
  guests: number;
  name: string;
  phone: string;
  email: string;
  specialRequests: string;
}
