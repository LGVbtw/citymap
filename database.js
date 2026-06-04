import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'citymap.db';

let databasePromise = null;

/**
 * Ouvre la base locale une seule fois et réutilise la même connexion.
 * Les données SQLite sont persistantes sur l'appareil.
 */
const getDatabase = () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  return databasePromise;
};

/**
 * Initialise les tables demandées par l'application.
 */
export const initializeDatabase = async () => {
  const db = await getDatabase();

  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS Utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE,
      username TEXT,
      mdp TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS Lieux_Sauvegardes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      osm_id TEXT,
      osm_type TEXT,
      note INTEGER,
      type_liste TEXT,
      FOREIGN KEY(user_id) REFERENCES Utilisateurs(id)
    );
  `);
};

/**
 * Inscrit un utilisateur et retourne l'id du nouvel enregistrement.
 */
export const inscriptionUtilisateur = async (login, username, mdp) => {
  const db = await getDatabase();

  const result = await db.runAsync(
    'INSERT INTO Utilisateurs (login, username, mdp) VALUES (?, ?, ?)',
    [login, username, mdp]
  );

  return result.lastInsertRowId;
};

/**
 * Connecte un utilisateur.
 * Retourne l'objet utilisateur si les identifiants sont valides, sinon null.
 */
export const connecterUtilisateur = async (login, mdp) => {
  const db = await getDatabase();

  return db.getFirstAsync(
    'SELECT id, login, username FROM Utilisateurs WHERE login = ? AND mdp = ?',
    [login, mdp]
  );
};

/**
 * Sauvegarde un lieu pour un utilisateur et retourne l'id de la ligne insérée.
 */
export const sauvegarderLieu = async (userId, osmId, osmType, note, typeListe) => {
  const db = await getDatabase();

  const result = await db.runAsync(
    'INSERT INTO Lieux_Sauvegardes (user_id, osm_id, osm_type, note, type_liste) VALUES (?, ?, ?, ?, ?)',
    [userId, osmId, osmType, note, typeListe]
  );

  return result.lastInsertRowId;
};
