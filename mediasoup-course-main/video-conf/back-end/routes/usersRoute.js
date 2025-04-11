const express = require("express");
const getUserByEmail = require("../utilities/getUserByEmail");
const createUser = require("../utilities/createUser");
const getUsers = require("../utilities/getUsers");
const deleteUser = require("../utilities/deleteUser");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const usersRouter = express.Router();

usersRouter.get("/auth/users", async function (req, res) {
  try {
    const users = await getUsers();
    return res.status(200).json({ users });
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      error: "خطا هنگام دریافت کاربران در بانک اطلاعاتی",
    });   
  }
})

usersRouter.post("/auth/login", async function (req, res) {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);
    if (!user || !user?.password) {
      return res.status(401).json({ error: 'رایانامه یا گذرواژه اشتباه است' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'رایانامه یا گذرواژه اشتباه است' });
    }

    const secret = process.env.JWT_SECRET;

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image
      },
      secret,
      { expiresIn: "1h" }
    );
    return res.status(200).json({ token });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: "خطا هنگام ورود به سایت" });
  }
});

usersRouter.post("/auth/register", async function (req, res) {
  try {
    const { email, password, role, firstName, lastName } = req.body;

    const recordedUser = await getUserByEmail(email);

    if (recordedUser) {
      return res.status(409).json({
        error: "کاربری با این رایانامه وجود دارد",
      });
    }

    const user = await createUser(email, password, role, firstName, lastName);

    if (user) {
      const u = {
        id: user.id,
        firstName: user.firstName,
        role: user.role,
        lastName: user.lastName,
        image: user.image,
      };
      return res.status(201).json({message: 'کاربر با موفقیت ثبت شد'});
    } else {
      return res.status(500).json({
        error: "خطا هنگام ایجاد کاربر در بانک اطلاعاتی",
      });
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      error: "خطا اتصال به سرور",
    });
  }
});

usersRouter.delete("/auth/users/:id", async function (req, res){
  try {
    const id = req.params.id;
    const user = await deleteUser(id);
    return res.status(200).json({ user });    
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      error: "خطا هنگام حذف کاربر از بانک اطلاعاتی",
    });  
  }
})

module.exports = usersRouter;
