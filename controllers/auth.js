const User = require("../models/user");
const bcrypt = require("bcryptjs"); // gói mã hóa password

const { validationResult } = require("express-validator");

exports.getLogin = (req, res, next) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errMessage: message,
    oldInput: { email: "", password: "" },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  // validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      errMessage: errors.array()[0].msg,
      oldInput: { email, password },
      validationErrors: errors.array(),
    });
  }

  User.findOne({ email })
    .then((user) => {
      if (!user) {
        req.flash("error", "Invalid email.");
        return res.redirect("/login");
      }
      // bcrypt.compare dùng để so sánh password đã mã hóa, nhận chuỗi password và hash đã mã hóa, trả về 1 promises giá trị true/false (chỉ trả về err khi có lỗi xảy ra)
      return bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.user = user;
            req.session.isLoggedIn = true;
            // session.save() dùng để đợi khi lưu session mặc dù lưu session vào db đc thực hiện mặc định nhưng việc này đảm bảo lưu trước khi chuyển hướng
            return req.session.save((err) => {
              console.log(err);
              return res.redirect("/");
            });
          }
          req.flash("error", "Invalid password.");
          return res.redirect("/login");
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));
};

exports.getSignup = (req, res, next) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    errMessage: message,
    oldInput: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationErrors: [],
  });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req); // validation tự động lưu các lỗi validate dữ liệu trong req
  if (!errors.isEmpty()) {
    console.log(errors.array());
    // isEmpty() của gói validator trả về true/false
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      errMessage: errors.array()[0].msg,
      oldInput: { email, password, confirmPassword: req.body.confirmPassword },
      validationErrors: errors.array(),
    });
  }

  // bcrypt.hash dùng để băm(mã hóa) password, nhận chuỗi password và số vòng mã hóa, càng lớn sẽ càng an toàn nhưng thời gian xử lý lâu, thường mức 12 đc chấp nhận
  bcrypt
    .hash(password, 12)
    .then((hashPassword) => {
      const user = new User({
        email,
        password: hashPassword,
        cart: { items: [] },
      });
      return user.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => console.log(err));
};

exports.postLogout = (req, res, next) => {
  // session.destroy dùng để xóa session nhận 1 hàm sẽ chạy s khi việc xóa session hoàn thành
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};
