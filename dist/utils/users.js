import { prisma } from '../lib/prisma.js';
export async function findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
}
export async function findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
}
export async function getAllUsers() {
    return prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
}
export async function createUser(data) {
    return prisma.user.create({
        data: {
            email: data.email,
            passwordHash: data.passwordHash,
            role: data.role,
            name: data.name,
            dashboardUrl: data.dashboardUrl,
            category: data.category ? categoryToEnum(data.category) : undefined,
            status: 'active',
        },
    });
}
export async function updateUser(id, data) {
    return prisma.user.update({
        where: { id },
        data: {
            ...data,
            category: data.category ? categoryToEnum(data.category) : undefined,
        },
    });
}
export async function deleteUser(id) {
    return prisma.user.delete({ where: { id } });
}
// Prisma stores enum keys like "Non_Veg"; the app uses "Non Veg" strings.
export function categoryToEnum(cat) {
    return cat.replace(/ /g, '_');
}
export function enumToCategory(val) {
    return val.replace(/_/g, ' ');
}
