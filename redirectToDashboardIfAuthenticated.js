function redirectToDashboardIfAuthenticated(req, res, next) {
    console.log("Checking if user is already authenticated");
    if (req.session && req.session.isLoggedIn) {
      return res.redirect('/dashboard');
    }
    next();
  }
  module.exports = redirectToDashboardIfAuthenticated;