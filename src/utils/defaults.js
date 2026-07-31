export const DEFAULT_BRANCHES = [
  { id: 'br1', name: 'Main Branch – Bangsar', address: 'Jalan Bangsar Utama, KL', phone: '0123456789', manager: 'Encik Hafiz', status: 'Active', createdAt: '2024-01-01' },
  { id: 'br2', name: 'Subang Jaya Outlet',    address: 'SS15, Subang Jaya, Selangor', phone: '0176543210', manager: 'Puan Salmah', status: 'Active', createdAt: '2024-03-01' },
];

export const DEFAULT_USERS = [
  { id: 1, username: 'admin',    password: 'admin123', role: 'Admin',  name: 'Encik Hafiz',   phone: '0123456789', status: 'Active', avatar: 'EH', branchId: 'br1', joined: 'Jan 2024' },
  { id: 2, username: 'washer01', password: 'pass123',  role: 'Washer', name: 'Ahmad Razif',   phone: '0198887766', status: 'Active', avatar: 'AR', branchId: 'br1', joined: 'Jan 2024' },
  { id: 3, username: 'washer02', password: 'pass123',  role: 'Washer', name: 'Siti Nuraini',  phone: '0177776655', status: 'Active', avatar: 'SN', branchId: 'br2', joined: 'Mar 2024' },
];

export const DEFAULT_PACKAGES = [
  { id: 'basic',     name: 'Basic Wash',     desc: 'Exterior rinse + dry',                     price: 25,  time: '20 min', color: '#3B82F6' },
  { id: 'premium',   name: 'Premium Wash',   desc: 'Exterior + interior wipe + tyre shine',    price: 55,  time: '45 min', color: '#8B5CF6' },
  { id: 'detailing', name: 'Full Detailing', desc: 'Deep clean, polish, wax, interior vacuum', price: 120, time: '2 hrs',  color: '#F59E0B' },
];

// ── Default Loyalty / Coupon Configuration ────────────────────────
export const DEFAULT_LOYALTY = {
  enabled:        true,
  visitThreshold: 3,             // visits needed to earn a reward
  discountType:   'percent',     // 'percent' | 'fixed'
  discountValue:  10,            // 10% or RM 10
  alertMessage:   '🎉 Congratulations! You have earned a loyalty reward for being a valued customer.',
  couponPrefix:   'WASH',
  validityDays:   30,            // coupon valid for 30 days after issue
};

export const PAY_METHODS = ['Cash', 'Online Transfer', 'QR Payment'];
export const ROLES       = ['Washer', 'Junior Washer', 'Senior Washer', 'Supervisor', 'SuperAdmin', 'SupremeAdmin'];