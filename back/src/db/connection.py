from db.connection import engine
from db.models import Base

# Crée les tables dans la base de données
Base.metadata.create_all(bind=engine)
print("Tables créées avec succès !")
