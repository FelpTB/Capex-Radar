-- Índice próprio dos diários estaduais que só publicam PDF (PA, PB, RO e RR).
-- O sincronizador baixa cada edição, extrai o texto de cada página e grava aqui.
-- O conector da ficha consulta estas tabelas em vez do portal.

create table if not exists doe_pdf_edicao (
  id bigserial primary key,
  uf text not null,
  chave text not null,
  data date not null,
  titulo text,
  url text not null,
  paginas integer,
  bytes bigint,
  status text not null default 'ok',
  erro text,
  lida_em timestamptz not null default now(),
  constraint doe_pdf_edicao_chave_uk unique (uf, chave),
  constraint doe_pdf_edicao_status_chk check (status in ('ok', 'erro', 'sem_texto'))
);

create index if not exists doe_pdf_edicao_uf_data_idx on doe_pdf_edicao (uf, data desc);

create table if not exists doe_pdf_pagina (
  id_edicao bigint not null references doe_pdf_edicao (id) on delete cascade,
  uf text not null,
  data date not null,
  pagina integer not null,
  texto text not null,
  -- Texto sem acento, minúsculo e só com letras e dígitos: casa nomes que o PDF partiu em pedaços.
  compacto text not null,
  -- Raízes de CNPJ (8 dígitos) citadas na página.
  raizes text[] not null default '{}',
  primary key (id_edicao, pagina)
);

create index if not exists doe_pdf_pagina_raizes_idx on doe_pdf_pagina using gin (raizes);
create index if not exists doe_pdf_pagina_uf_data_idx on doe_pdf_pagina (uf, data desc);

comment on table doe_pdf_edicao is
  'Edições dos diários estaduais sem busca no portal (PA, PB, RO, RR), uma linha por PDF lido.';
comment on table doe_pdf_pagina is
  'Texto de cada página dessas edições, com as raízes de CNPJ citadas, para o conector CAPTURA-DOE-{UF}.';

alter table doe_pdf_edicao enable row level security;
alter table doe_pdf_pagina enable row level security;
