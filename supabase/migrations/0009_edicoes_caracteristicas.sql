-- Características / comodidades de cada edição (barracas de comida, bebida,
-- música, fogo, entrada gratuita, etc.), mostradas na aba "Acerca de".
alter table edicoes add column if not exists caracteristicas text[];

update edicoes e set caracteristicas = array[
  'Barracas de comida','Barracas de bebida','Música ao vivo','Fogo de artifício',
  'Procissão religiosa','Feira de artesanato','Cortejo etnográfico',
  'Entrada gratuita','Para famílias'
] from festas f where f.id = e.festa_id and f.slug = 'romaria-da-agonia';

update edicoes e set caracteristicas = array[
  'Barracas de comida','Barracas de bebida','Música ao vivo','Concertos',
  'Fogo de artifício','Feira','Cortejo de gigantones','Entrada gratuita',
  'Estacionamento','Para famílias'
] from festas f where f.id = e.festa_id and f.slug = 'feiras-novas';

update edicoes e set caracteristicas = array[
  'Barracas de comida','Barracas de bebida','Procissão religiosa','Junto à praia',
  'Entrada gratuita','Para famílias'
] from festas f where f.id = e.festa_id and f.slug = 'sao-bartolomeu-do-mar';

update edicoes e set caracteristicas = array[
  'Barracas de comida','Barracas de bebida','Música ao vivo','Procissão religiosa',
  'Junto ao mar','Fogo de artifício','Entrada gratuita'
] from festas f where f.id = e.festa_id and f.slug = 'festas-senhora-boa-viagem';

update edicoes e set caracteristicas = array[
  'Barracas de comida','Barracas de bebida','Música ao vivo','Marchas populares',
  'Fogo preso','Entrada gratuita','Para famílias'
] from festas f where f.id = e.festa_id and f.slug = 'festas-divino-salvador';
