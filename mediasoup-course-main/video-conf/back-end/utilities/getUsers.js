const prisma = require("./prisma");

const getUsers = async () => {
    try {
        const users = await prisma.users.findMany();
        return users.map((user) => {
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName ,
                lastName: user.lastName,
                image: user.image ,
                createdAt: user.createdAt
            };
        });
    } catch (error) {
        console.log(error);
        return null;
    }
}

module.exports = getUsers
