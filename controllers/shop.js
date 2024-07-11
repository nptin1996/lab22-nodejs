const Product = require("../models/product");
const Order = require("../models/order");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.getProducts = (req, res, next) => {
  Product.find()
    .then((products) => {
      console.log(products);
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => console.log(err));
};

exports.getIndex = (req, res, next) => {
  Product.find()
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => console.log(err));
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      console.log(result);
      res.redirect("/cart");
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => console.log(err));
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });

      // tạo file PDF hóa đơn
      const doc = new PDFDocument();
      const filePath = path.join(
        "data",
        "invoices",
        `invoice-${order._id.toString()}.pdf`
      );
      doc.pipe(fs.createWriteStream(filePath));
      doc.moveDown();
      doc.moveDown();
      doc
        .fillColor("#364fc7")
        .fontSize(26)
        .text("Lab Invoice", { align: "center" });
      doc.moveDown();

      let total = 0;
      order.products.forEach((element, i) => {
        total += element.quantity * element.product.price;
        doc
          .fillColor("#1864ab")
          .fontSize(16)
          .text(
            `${i + 1}. ${element.product.title} ($${element.product.price})  x${
              element.quantity
            }`,
            { paragraphGap: 5 }
          );
      });
      doc.moveDown();
      doc
        .fillColor("#2f9e44")
        .text("---------------------------------------", { align: "right" });
      doc.fontSize(20).text(`Total: ${total}$`, { align: "right" });
      doc.moveDown();
      doc
        .fontSize(14)
        .fillColor("#1864ab")
        .text(`#Order ID - ${order._id.toString()}`);
      doc.image("data/funix.png", 430, 15, {
        fit: [100, 100],
        align: "center",
        valign: "center",
      });
      doc.end();

      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => console.log(err));
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => console.log(err));
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) throw new Error("No order found.");
      if (order.user.userId.toString() !== req.user._id.toString())
        throw new Error("Unauthorize.");

      // hiển thị bằng createReadStream không đọc file trực tiếp mà tạo luồng dữ liệu => hiệu năng tốt hơn
      const file = fs.createReadStream(
        path.join("data", "invoices", `invoice-${orderId}.pdf`)
      );
      res.setHeader("Content-Type", "application/pdf");
      file.pipe(res); // hàm file cho phép truyền dữ liệu từ 1 luồng sang 1 luồng khác (response là 1 luồng)
    })
    .catch((err) => next(err));
};
