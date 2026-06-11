import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Issue

app = Flask(__name__)
CORS(app) # Enable CORS for frontend

# Database configuration
BASE_DIR = os.path.abspath(os.path.dirname(__name__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'transport_alert.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/api/issues', methods=['GET'])
def get_issues():
    issues = Issue.query.order_by(Issue.created_at.desc()).all()
    return jsonify([issue.to_dict() for issue in issues]), 200

@app.route('/api/issues', methods=['POST'])
def create_issue():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    new_issue = Issue(
        title=data.get('title'),
        issue_type=data.get('issue_type'),
        description=data.get('description'),
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        severity=data.get('severity', 'Medium'),
        status='Active'
    )
    
    db.session.add(new_issue)
    db.session.commit()
    
    return jsonify(new_issue.to_dict()), 201

@app.route('/api/issues/<int:issue_id>/resolve', methods=['PUT'])
def resolve_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    issue.status = 'Resolved'
    db.session.commit()
    return jsonify(issue.to_dict()), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
