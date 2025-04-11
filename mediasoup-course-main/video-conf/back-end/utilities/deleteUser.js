const prisma = require("./prisma");

const deleteUser = async (id) => {
  try {
    const user = await prisma.users.delete({
      where: { id },
    });
    return user;
  } catch (error) {
    console.log(error);
    return null;
  }
};

module.exports = deleteUser;
