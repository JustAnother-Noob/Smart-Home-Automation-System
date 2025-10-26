
class ResponseUtils {

  static success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      message
    };
    
    if (data !== null) {
      response.data = data;
    }
    
    return res.status(statusCode).json(response);
  }

  static error(res, message = 'An error occurred', statusCode = 500, field = null) {
    const response = {
      success: false,
      message
    };
    
    if (field) {
      response.field = field;
    }
    
    return res.status(statusCode).json(response);
  }

  static validationError(res, errors) {
    let message;
    
    if (Array.isArray(errors)) {
      message = errors.join(', ');
    } else if (typeof errors === 'object') {
      message = Object.values(errors).map(err => 
        typeof err === 'object' ? err.message : err
      ).join(', ');
    } else {
      message = errors.toString();
    }
    
    return res.status(400).json({
      success: false,
      message
    });
  }

  static notFound(res, resource = 'Resource') {
    return res.status(404).json({
      success: false,
      message: `${resource} not found`
    });
  }

  static unauthorized(res, message = 'Authentication required') {
    return res.status(401).json({
      success: false,
      message
    });
  }

  static forbidden(res, message = 'Access denied') {
    return res.status(403).json({
      success: false,
      message
    });
  }

  static conflict(res, message = 'Resource already exists') {
    return res.status(409).json({
      success: false,
      message
    });
  }
  
  static tooManyRequests(res, message = 'Too many requests') {
    return res.status(429).json({
      success: false,
      message
    });
  }
}

module.exports = ResponseUtils;