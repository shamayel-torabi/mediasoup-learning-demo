const prisma = require("./prisma");
const bcrypt = require("bcrypt");

const saltRounds = 10;

const createUser = async (email, password, role, firstName, lastName) => {
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const id = crypto.randomUUID().toString();
    const user = await prisma.users.create({
      data: {
        id,
        email,
        password: hashedPassword,
        role: role,
        firstName,
        lastName,
      },
    });
    return user;
  } catch (error) {
    console.log(error);
    return null;
  }
};

module.exports = createUser;
