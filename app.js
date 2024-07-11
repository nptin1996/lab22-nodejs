require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("connect-flash");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const csrfProtection = csrf();
const helmet = require("helmet");
const compression = require("express-compression");
const morgan = require("morgan");

const errorController = require("./controllers/error");
const User = require("./models/user");
const app = express();

const store = new MongoDBStore({
  uri: `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.bh8lnau.mongodb.net/shop`,
  collection: "sessions",
});

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" }
);
app.use(helmet()); // set bảo mật header
app.use(compression()); // Nén asset
app.use(morgan("combined", { stream: accessLogStream })); // Request Logging

const multer = require("multer"); // thư viện trung gian hỗ trợ việc xử lý multipart/form-data, mục đích chính cho việc upload file.

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
    // file.fieldname: thể loại file, file.originalname: tên ban đầu (bao gồm cả đuôi file)
  },
});

function fileFilter(req, file, cb) {
  // hàm này sẽ gọi callback `cb` với 1 biến boolean
  // để chỉ ra rằng file có được chấp nhận hay không

  // Để chấp nhận file này, truỳen `true`, như sau:
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    // Để chặn file này, truyền `false` như sau:
    cb(null, false);
  }

  // Hoặc bạn có thể truyền vào 1 lỗi nếu có vấn đề xảy ra:
  // cb(new Error("I don't have a clue!"));
}

const upload = multer({ storage: storage, fileFilter: fileFilter });
app.use(upload.single("image"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(
  session({
    secret: "My secret", // dùng như ID để mã hóa vào cookie thường sẽ là 1 string dài
    resave: false, // thiết lập để session không thay đổi khi request tới hoặc response đc gửi mà chỉ khi có thay đổi trong phiên
    saveUninitialized: false, // đảm bảo không có phiên nào lưu trữ cho 1 request không cần thiết vì
    store: store, // store lưu trữ vào mongoDb
  })
);

// phải dùng CSRF token ngay sau middleware khai báo session, việc này sẽ ngăn các post res không có csrf token truy cập vào máy chủ
app.use(csrfProtection);

app.use(flash()); // gói truyền dữ liệu vào cookie và dữ liệu này sẽ được lấy ra sử dụng ngay s đó, sau đó sẽ tự động xóa (thường dùng gửi lỗi cho server side render)

// res.loocals khai báo mặc định các views sẽ được truyền chung cố định 1 vài dữ liệu
app.use((req, res, next) => {
  // console.log(req.session.isLoggedIn);
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }

  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      // console.log(req.user);
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
});

// ĐỂ TRUYỀN LỖI ĐẾN MIDDLEWARE ERROR trong các middleware bất đồng bộ dùng next(err), trong hàm đồng bộ dùng throw err

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);
app.get("/500", errorController.get500);
app.use(errorController.get404);

// middleware sử lý lỗi, node js hiện đại tự nhận biết middleware error khi khai báo thêm tham số error vào callback fn
app.use((error, req, res, next) => {
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
    isAuthenticated: req.session.isLoggedIn,
    csrfToken: req.csrfToken(),
  });
});

mongoose
  .connect(
    `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.bh8lnau.mongodb.net/shop?retryWrites=true&w=majority&appName=Cluster0`
  )
  .then((result) => {
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log(err);
  });
