-- Runs only on first initialisation of the postgres volume.
-- Creates the additional databases used by GlitchTip and Plausible.
-- `wtg` is already created by POSTGRES_DB.
CREATE DATABASE glitchtip;
CREATE DATABASE plausible;
