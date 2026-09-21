-- =====================================================================
-- Script de criação e povoamento do banco de dados
-- Domínio: prestadores de serviço, clientes, chamados e avaliações
-- Compatível com PostgreSQL 13+
-- =====================================================================

BEGIN;

-- Reexecução idempotente (drop em ordem reversa por causa das FKs)
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS providers CASCADE;
DROP TYPE IF EXISTS call_status;

-- =====================================================================
-- Tipos
-- =====================================================================

CREATE TYPE call_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- =====================================================================
-- Tabela: providers  (Provider { id, nome, especialidade, telefone })
-- =====================================================================

CREATE TABLE providers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    specialty   VARCHAR(100) NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    CONSTRAINT chk_providers_phone_not_blank CHECK (btrim(phone) <> '')
);

-- =====================================================================
-- Tabela: customers  (Customer { id, nome, telefone, endereco })
-- =====================================================================

CREATE TABLE customers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    address     VARCHAR(255) NOT NULL,
    CONSTRAINT chk_customers_phone_not_blank CHECK (btrim(phone) <> '')
);

-- =====================================================================
-- Tabela: calls  (Call { id, clienteId, profissionalId, especialidade,
--                        status, criadoEm, finalizadoEm? })
-- =====================================================================

CREATE TABLE calls (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    provider_id     INTEGER NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    specialty       VARCHAR(100) NOT NULL,
    status          call_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    CONSTRAINT chk_calls_finished_after_created
        CHECK (finished_at IS NULL OR finished_at >= created_at),
    CONSTRAINT chk_calls_finished_requires_completed
        CHECK (finished_at IS NULL OR status = 'completed')
);

CREATE INDEX idx_calls_customer_id ON calls(customer_id);
CREATE INDEX idx_calls_provider_id ON calls(provider_id);
CREATE INDEX idx_calls_status      ON calls(status);

-- =====================================================================
-- Tabela: reviews  (Review { id, chamadoId, profissionalId, nota,
--                             comentario })
-- =====================================================================

CREATE TABLE reviews (
    id              SERIAL PRIMARY KEY,
    call_id         INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    provider_id     INTEGER NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    rating          SMALLINT NOT NULL,
    comment         TEXT,
    CONSTRAINT chk_reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT uq_reviews_call_id UNIQUE (call_id) -- 1 avaliação por chamado
);

CREATE INDEX idx_reviews_provider_id ON reviews(provider_id);

-- =====================================================================
-- Povoamento: providers (5)
-- =====================================================================

INSERT INTO providers (id, name, specialty, phone) VALUES
    (1, 'João Silva',      'Eletricista',  '11987650001'),
    (2, 'Maria Souza',     'Encanamento',  '11987650002'),
    (3, 'Carlos Pereira',  'Jardinagem',   '11987650003'),
    (4, 'Ana Costa',       'Limpeza',      '11987650004'),
    (5, 'Pedro Santos',    'Pintura',      '11987650005');

-- =====================================================================
-- Povoamento: customers (20)
-- =====================================================================

INSERT INTO customers (id, name, phone, address) VALUES
    (1,  'Fernanda Lima',     '11976543001', 'Rua das Flores, 100 - São Paulo/SP'),
    (2,  'Ricardo Alves',     '11976543002', 'Av. Paulista, 200 - São Paulo/SP'),
    (3,  'Juliana Rocha',     '11976543003', 'Rua Augusta, 300 - São Paulo/SP'),
    (4,  'Bruno Martins',     '11976543004', 'Rua Oscar Freire, 400 - São Paulo/SP'),
    (5,  'Camila Ferreira',   '11976543005', 'Av. Rebouças, 500 - São Paulo/SP'),
    (6,  'Lucas Barbosa',     '11976543006', 'Rua Consolação, 600 - São Paulo/SP'),
    (7,  'Patrícia Gomes',    '11976543007', 'Av. Brigadeiro Faria Lima, 700 - São Paulo/SP'),
    (8,  'Rafael Cardoso',    '11976543008', 'Rua Haddock Lobo, 800 - São Paulo/SP'),
    (9,  'Larissa Teixeira',  '11976543009', 'Rua Bela Cintra, 900 - São Paulo/SP'),
    (10, 'Thiago Ribeiro',    '11976543010', 'Av. Faria Lima, 1000 - São Paulo/SP'),
    (11, 'Beatriz Nunes',     '11976543011', 'Rua Vergueiro, 1100 - São Paulo/SP'),
    (12, 'Gustavo Dias',      '11976543012', 'Av. Ipiranga, 1200 - São Paulo/SP'),
    (13, 'Aline Correia',     '11976543013', 'Rua Sete de Abril, 1300 - São Paulo/SP'),
    (14, 'Rodrigo Pinto',     '11976543014', 'Av. São João, 1400 - São Paulo/SP'),
    (15, 'Vanessa Moura',     '11976543015', 'Rua Direita, 1500 - São Paulo/SP'),
    (16, 'Felipe Castro',     '11976543016', 'Av. Angélica, 1600 - São Paulo/SP'),
    (17, 'Mariana Azevedo',   '11976543017', 'Rua Estados Unidos, 1700 - São Paulo/SP'),
    (18, 'Diego Farias',      '11976543018', 'Av. Nove de Julho, 1800 - São Paulo/SP'),
    (19, 'Renata Vieira',     '11976543019', 'Rua Cardeal Arcoverde, 1900 - São Paulo/SP'),
    (20, 'André Lopes',       '11976543020', 'Av. Europa, 2000 - São Paulo/SP');

-- =====================================================================
-- Povoamento: calls (15) -> 12 completed, 1 in_progress, 1 pending, 1 cancelled
-- =====================================================================

INSERT INTO calls (id, customer_id, provider_id, specialty, status, created_at, finished_at) VALUES
    (1,  1,  1, 'Eletricista', 'completed',   '2026-08-01 09:00:00-03', '2026-08-01 11:00:00-03'),
    (2,  2,  2, 'Encanamento', 'completed',   '2026-08-02 10:00:00-03', '2026-08-02 12:30:00-03'),
    (3,  3,  3, 'Jardinagem',  'completed',   '2026-08-03 08:00:00-03', '2026-08-03 10:00:00-03'),
    (4,  4,  4, 'Limpeza',     'completed',   '2026-08-04 13:00:00-03', '2026-08-04 16:00:00-03'),
    (5,  5,  5, 'Pintura',     'completed',   '2026-08-05 09:00:00-03', '2026-08-06 17:00:00-03'),
    (6,  6,  1, 'Eletricista', 'completed',   '2026-08-07 14:00:00-03', '2026-08-07 15:30:00-03'),
    (7,  7,  2, 'Encanamento', 'completed',   '2026-08-08 09:30:00-03', '2026-08-08 11:00:00-03'),
    (8,  8,  3, 'Jardinagem',  'completed',   '2026-08-09 08:30:00-03', '2026-08-09 12:00:00-03'),
    (9,  9,  4, 'Limpeza',     'completed',   '2026-08-10 10:00:00-03', '2026-08-10 13:00:00-03'),
    (10, 10, 5, 'Pintura',     'completed',   '2026-08-11 09:00:00-03', '2026-08-12 18:00:00-03'),
    (11, 11, 1, 'Eletricista', 'completed',   '2026-08-13 15:00:00-03', '2026-08-13 16:00:00-03'),
    (12, 12, 2, 'Encanamento', 'completed',   '2026-08-14 11:00:00-03', '2026-08-14 13:00:00-03'),
    (13, 13, 3, 'Jardinagem',  'in_progress', '2026-08-15 08:00:00-03', NULL),
    (14, 14, 4, 'Limpeza',     'pending',     '2026-08-16 09:00:00-03', NULL),
    (15, 15, 5, 'Pintura',     'cancelled',   '2026-08-17 10:00:00-03', NULL);

-- =====================================================================
-- Povoamento: reviews (12) -> uma para cada chamado concluído (1-12)
-- =====================================================================

INSERT INTO reviews (id, call_id, provider_id, rating, comment) VALUES
    (1,  1,  1, 5, 'Excelente atendimento, resolveu o problema elétrico rapidamente.'),
    (2,  2,  2, 4, 'Bom serviço, mas chegou um pouco atrasado.'),
    (3,  3,  3, 5, 'Jardim ficou impecável, super recomendo.'),
    (4,  4,  4, 3, 'Serviço ok, esperava um pouco mais de capricho.'),
    (5,  5,  5, 5, 'Pintura ficou perfeita, muito profissional.'),
    (6,  6,  1, 4, 'Resolveu o problema, mas explicou pouco sobre a causa.'),
    (7,  7,  2, 2, 'Vazamento voltou dois dias depois.'),
    (8,  8,  3, 5, 'Muito atencioso e pontual.'),
    (9,  9,  4, 4, 'Limpeza completa, gostei do resultado.'),
    (10, 10, 5, 5, 'Trabalho de pintura excelente, acabamento perfeito.'),
    (11, 11, 1, 3, 'Serviço mediano, resolveu mas demorou mais que o combinado.'),
    (12, 12, 2, 4, 'Bom profissional, recomendo.');

-- =====================================================================
-- Ajusta as sequences para continuar a partir do próximo ID livre
-- (necessário porque os INSERTs acima especificam os IDs manualmente)
-- =====================================================================

SELECT setval(pg_get_serial_sequence('providers', 'id'), (SELECT MAX(id) FROM providers));
SELECT setval(pg_get_serial_sequence('customers', 'id'), (SELECT MAX(id) FROM customers));
SELECT setval(pg_get_serial_sequence('calls',     'id'), (SELECT MAX(id) FROM calls));
SELECT setval(pg_get_serial_sequence('reviews',   'id'), (SELECT MAX(id) FROM reviews));

COMMIT;
