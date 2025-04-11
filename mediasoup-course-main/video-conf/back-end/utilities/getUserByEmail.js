const prisma = require("./prisma");

const getUserByEmail = async (email) => {
  try {
    const user = await prisma.users.findUnique({
      where: { email },
    });
    return user;
  } catch (error) {
    console.log(error);
    return null;
  }
};

module.exports = getUserByEmail;
