from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Issue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    issue_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    photo_path = db.Column(db.String(255), nullable=True)
    severity = db.Column(db.String(20), default='Medium')
    status = db.Column(db.String(20), default='Active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'issue_type': self.issue_type,
            'description': self.description,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'photo_path': self.photo_path,
            'severity': self.severity,
            'status': self.status,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None
        }
