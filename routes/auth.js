const express = require("express");
const { check, body } = require("express-validator");
const User = require("../models/user");

const authController = require("../controllers/auth");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  body("email")
    .isEmail()
    .withMessage("Please enter a valid email.")
    .normalizeEmail(), // làm sạch dữ liệu, như đảm bảo k có viết hoa, khoảng trắng thừa,..
  body(
    "password",
    "Please enter a password with only number and text and at least 5 characters"
  )
    .isLength({ min: 5 })
    .isAlphanumeric() // chỉ cho phép số và chữ
    .trim(), // làm sạch loại bỏ khoảng trắng thừa
  authController.postLogin
);

// validator
router.post(
  "/signup",
  [
    check("email") // check sẽ tìm kiếm và kiểm tra dữ liệu trên toàn bộ request(cookie, header, body, params,...)
      .isEmail()
      .withMessage("Please enter a valid email.")

      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("Email has been used.");
          }
        });
      })
      .normalizeEmail(),
    // body chỉ kiểm tra trong body data
    // body hoặc check nhận tham số đầu tiên là tên dữ liệu cần kiểm tra, thứ 2 là msg lỗi (k thiết lập sẽ mặc định là Invalid)
    body(
      "password",
      "Please enter a password with only number and text and at least 5 characters"
    )
      .isLength({ min: 5 })
      .isAlphanumeric() // chỉ cho phép số và chữ
      .trim(),
    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords have to match!");
        }
        return true;
      }),
  ],
  authController.postSignup
);

router.post("/logout", authController.postLogout);

module.exports = router;
