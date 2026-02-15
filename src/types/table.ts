export type TableZone = 'inside' | 'garden' | 'room' | 'mezz';
export type DiningStatus = 'pending' | 'reserved' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  zone: TableZone;
  seats: number;
  is_active: boolean;
  created_at: string;
}

export interface TableConflict {
  reservation_id: string;
  start_time: string;
  end_time: string;
  customer_name: string;
}

export interface ReservationWithTable {
  id: string;
  reservation_date: string;
  reservation_time: string;
  reservation_end_time: string | null;
  guests: number;
  status: string;
  dining_status: DiningStatus;
  notes: string | null;
  special_requests: string | null;
  source: string;
  created_at: string;
  assigned_table_id: string | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  } | null;
  assigned_table?: RestaurantTable | null;
}
