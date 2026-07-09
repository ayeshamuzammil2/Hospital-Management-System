function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== role) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }
    next();
  };
}

const requirePatient = requireRole('patient');
const requireDoctor = requireRole('doctor');
const requireAdmin = requireRole('admin');

function requireAnyAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  next();
}

module.exports = { requirePatient, requireDoctor, requireAdmin, requireAnyAuth };
