-- Segmentos novos (Pontos de Melhora 23/11/2026, item 3): os nichos de
-- seeds/capex_radar/segmentos.json entram nas checagens de grupos e nicho_cnae.

alter table capex_radar.grupos drop constraint if exists grupos_nicho_check;
alter table capex_radar.grupos add constraint grupos_nicho_check
  check (nicho in ('papel_celulose', 'alimentos_bebidas', 'ecommerce', 'datacenter', 'portuario', 'telecom', 'varejo', 'textil', 'saude', 'farmaceutico', 'quimico', 'automotivo', 'siderurgia', 'materiais_construcao', 'maquinas', 'eletronicos', 'borracha_plastico', 'bioenergia', 'mineracao', 'madeira_moveis', 'industria'));

alter table capex_radar.nicho_cnae drop constraint if exists nicho_cnae_nicho_check;
alter table capex_radar.nicho_cnae add constraint nicho_cnae_nicho_check
  check (nicho in ('papel_celulose', 'alimentos_bebidas', 'ecommerce', 'datacenter', 'portuario', 'telecom', 'varejo', 'textil', 'saude', 'farmaceutico', 'quimico', 'automotivo', 'siderurgia', 'materiais_construcao', 'maquinas', 'eletronicos', 'borracha_plastico', 'bioenergia', 'mineracao', 'madeira_moveis', 'industria'));

-- CNAE prioritários dos nichos novos (prefixo do CNAE principal da filial).
insert into capex_radar.nicho_cnae (nicho, cnae_prefixo, tipo, descricao) values
  ('portuario', '5231', 'logistica', 'Portos e terminais'),
  ('portuario', '5232', 'logistica', 'Portos e terminais'),
  ('portuario', '5239', 'logistica', 'Portos e terminais'),
  ('telecom', '61', 'infraestrutura', 'Telecomunicações'),
  ('varejo', '4711', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4712', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4744', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4753', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4754', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4771', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4781', 'logistica', 'Varejo e atacarejo'),
  ('varejo', '4639', 'logistica', 'Varejo e atacarejo'),
  ('textil', '13', 'industrial', 'Têxtil, vestuário e calçados'),
  ('textil', '14', 'industrial', 'Têxtil, vestuário e calçados'),
  ('textil', '15', 'industrial', 'Têxtil, vestuário e calçados'),
  ('saude', '8610', 'infraestrutura', 'Hospitais e saúde'),
  ('saude', '8640', 'infraestrutura', 'Hospitais e saúde'),
  ('farmaceutico', '21', 'industrial', 'Farmacêutico'),
  ('quimico', '20', 'industrial', 'Química e petroquímica'),
  ('automotivo', '29', 'industrial', 'Automotivo'),
  ('siderurgia', '24', 'industrial', 'Siderurgia e metalurgia'),
  ('materiais_construcao', '23', 'industrial', 'Cimento, vidro e cerâmica'),
  ('maquinas', '27', 'industrial', 'Máquinas e equipamentos elétricos'),
  ('maquinas', '28', 'industrial', 'Máquinas e equipamentos elétricos'),
  ('eletronicos', '26', 'industrial', 'Eletrônicos'),
  ('borracha_plastico', '22', 'industrial', 'Borracha e plástico'),
  ('bioenergia', '1931', 'industrial', 'Bioenergia e etanol'),
  ('bioenergia', '1932', 'industrial', 'Bioenergia e etanol'),
  ('mineracao', '07', 'insumo', 'Mineração'),
  ('mineracao', '08', 'insumo', 'Mineração'),
  ('madeira_moveis', '16', 'industrial', 'Madeira e móveis'),
  ('madeira_moveis', '31', 'industrial', 'Madeira e móveis')
on conflict (nicho, cnae_prefixo) do nothing;
