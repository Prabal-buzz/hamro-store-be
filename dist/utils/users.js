import bcrypt from 'bcryptjs';
// Pre-generate the password hash synchronously during initialization
const defaultPasswordHash = bcrypt.hashSync('password123', 10);
export const seedUsers = [
    {
        id: 'user-admin-1',
        email: 'admin@hamrostore.com',
        passwordHash: defaultPasswordHash,
        role: 'admin',
        name: 'Admin User',
        dashboardUrl: '/admin/dashboard',
        status: 'active',
        createdAt: new Date('2024-01-01').toISOString(),
    },
    {
        id: 'user-customer-1',
        email: 'customer@hamrostore.com',
        passwordHash: defaultPasswordHash,
        role: 'customer',
        name: 'Customer User',
        dashboardUrl: '/customer/dashboard',
        status: 'active',
        createdAt: new Date('2024-02-15').toISOString(),
    },
    {
        id: 'user-vendor-1',
        email: 'vendor@hamrostore.com',
        passwordHash: defaultPasswordHash,
        role: 'vendor',
        name: 'Vendor User',
        dashboardUrl: '/vendor/dashboard',
        status: 'active',
        createdAt: new Date('2024-03-10').toISOString(),
    },
];
