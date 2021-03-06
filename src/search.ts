import Fuse from 'fuse.js';
import prefixes from './rdf-ontologies/prefixes';
import { importNqFromPrefix } from './rdf-ontologies/loadDataset';
import { JsonLdObj } from 'jsonld/jsonld-spec';

/** Add the comment and label keys without a dot in the name to enable Fuse to search them */
const prepareData = (ontology: {
  '@id': string; // ontology uri
  '@graph': Array<JsonLdObj>; // ontology triples
}) => {
  return ontology['@graph'].map((obj: any) => ({
    ontology: ontology['@id'],
    label: obj?.['http://www.w3.org/2000/01/rdf-schema#label'] as
      | Array<{ '@value': string; '@language'?: string }>
      | undefined,
    comment: obj['http://www.w3.org/2000/01/rdf-schema#comment'] as
      | Array<{ '@value': string; '@language'?: string }>
      | undefined,
    ...obj,
  }));
};

const mergedOntologies = async () => {
  const promises = Object.keys(prefixes).map(
    async p =>
      JSON.parse(await importNqFromPrefix(p)) as {
        '@id': string; // ontology uri
        '@graph': Array<JsonLdObj>; // ontology triples
      },
  );
  const ontologies = await Promise.all(promises);
  return ontologies;
};

let fuse: Fuse<unknown, Fuse.IFuseOptions<unknown>> | null = null;
export const prepareIndex = async () => {
  try {
    const jsonLdOntologies = await mergedOntologies();
    const flatData = jsonLdOntologies.flatMap(o => prepareData(o));

    const fuseOptions: Fuse.IFuseOptions<unknown> = {
      includeScore: true,
      distance: 1000,
      useExtendedSearch: true,
      // keys to search in
      keys: [
        {
          name: 'ontology',
          weight: 1,
        },
        {
          name: 'label.@value',
          weight: 1,
        },
        {
          name: 'comment.@value',
          weight: 0.5,
        },
        {
          name: '@id',
          weight: 0.5,
        },
        {
          name: '@type',
          weight: 1,
        },
      ],
    };
    // // Create the Fuse index
    const myIndex = Fuse.createIndex(
      // @ts-ignore
      fuseOptions.keys.map(k => k.name),
      flatData,
    );
    console.log('index created');
    fuse = new Fuse(flatData, fuseOptions, myIndex);
  } catch (e) {
    console.log(e);
  }
};

export const search = (searchType: 'predicate' | 'type', searchWord: string) => {
  // "$" tells fuse what word the searched "type" needs to end with
  const formattedSearchType = searchType === 'predicate' ? 'Property$' : 'Class$';

  if (!fuse) return;
  console.log('custom search', fuse);

  return fuse.search(
    {
      $and: [
        { '@type': formattedSearchType },
        { $or: [{ 'label.@value': searchWord }, { 'comment.@value': searchWord }] },
        // {
        //   $or: [
        //     { ontology: "'http://purl.org/goodrelations/v1#" },
        //     { ontology: "'http://www.w3.org/ns/activitystreams#" },
        //     // { ontology: "'http://dbpedia.org/ontology/" },
        //     { ontology: "'http://schema.org/" },
        //   ],
        // },
      ],
    },
    { limit: 100 },
  );
  // .map(result => result.item);
};
