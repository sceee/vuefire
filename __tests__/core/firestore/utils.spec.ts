import firebase from 'firebase'
import { generateRandomID, initFirebase } from '../../src'
import { createSnapshot, extractRefs } from '../../../src/firestore/utils'

beforeAll(() => {
  initFirebase()
})

describe('Firestore utils', () => {
  let doc: firebase.firestore.DocumentSnapshot,
    snapshot: Record<string, unknown>,
    collection: firebase.firestore.CollectionReference,
    docRef: firebase.firestore.DocumentReference

  beforeEach(async () => {
    collection = firebase.firestore().collection(generateRandomID())
    docRef = await collection.add({})

    const docTest = await collection.add({
      n: 42,
      is: true,
      items: [{ text: 'foo' }],
      ref: docRef,
    })
    doc = await docTest.get()
    expect(doc.exists).toBeTruthy()

    snapshot = createSnapshot(doc)
  })

  it('createSnapshot adds an id', () => {
    expect(snapshot.id).toMatch(/^[\d|a-zA-Z]+$/)
  })

  it('id is not enumerable', () => {
    expect(Object.keys(snapshot).includes('id')).toBe(false)
  })

  it('contains all the data', () => {
    expect(snapshot.n).toEqual(42)
    expect(snapshot.is).toEqual(true)
    expect(snapshot.items).toEqual([{ text: 'foo' }])
    expect((snapshot.ref as firebase.firestore.DocumentReference).path).toEqual(
      docRef.path
    )
  })

  it('extract refs from document', () => {
    const [noRefsDoc, refs] = extractRefs(doc.data()!, undefined, {})
    expect(noRefsDoc.ref).toBe(docRef.path)
    expect(refs.ref).toBeTruthy()
    expect(refs.ref.path).toEqual(docRef.path)
  })

  it('leave Date objects alone when extracting refs', () => {
    const d = new Date()
    const [doc, refs] = extractRefs(
      {
        foo: 1,
        bar: d,
      },
      undefined,
      {}
    )
    expect(doc.foo).toBe(1)
    expect(doc.bar).toBe(d)
    expect(refs).toEqual({})
  })

  it('leave Timestamps objects alone when extracting refs', () => {
    const d = new firebase.firestore.Timestamp(10, 10)
    const [doc, refs] = extractRefs(
      {
        foo: 1,
        bar: d,
      },
      undefined,
      {}
    )
    expect(doc.foo).toBe(1)
    expect(doc.bar).toBe(d)
    expect(refs).toEqual({})
  })

  it('leave GeoPoint objects alone when extracting refs', () => {
    const d = new firebase.firestore.GeoPoint(2, 48)
    const [doc, refs] = extractRefs(
      {
        foo: 1,
        bar: d,
      },
      undefined,
      {}
    )
    expect(doc.foo).toBe(1)
    expect(doc.bar).toBe(d)
    expect(refs).toEqual({})
  })

  it('extract object nested refs from document', () => {
    const [noRefsDoc, refs] = extractRefs(
      {
        obj: {
          ref: docRef,
        },
      },
      undefined,
      {}
    )
    expect(noRefsDoc.obj.ref).toBe(docRef.path)
    expect(refs).toEqual({
      'obj.ref': docRef,
    })
  })

  it('works with null', () => {
    const [noRefsDoc, refs] = extractRefs(
      {
        a: null,
        nested: {
          a: null,
        },
      },
      undefined,
      {}
    )
    expect(noRefsDoc).toEqual({
      a: null,
      nested: {
        a: null,
      },
    })
    expect(refs).toEqual({})
  })

  it('extract deep object nested refs from document', () => {
    const [noRefsDoc, refs] = extractRefs(
      {
        obj: {
          nested: {
            ref: docRef,
          },
        },
      },
      undefined,
      {}
    )
    expect(noRefsDoc.obj.nested.ref).toBe(docRef.path)
    expect(refs).toEqual({
      'obj.nested.ref': docRef,
    })
  })

  it('extracts refs from array', async () => {
    const docRef2 = await collection.add({})
    const [noRefsDoc, refs] = extractRefs(
      {
        arr: [docRef, docRef2, docRef],
      },
      undefined,
      {}
    )
    expect(noRefsDoc.arr[0]).toBe(docRef.path)
    expect(noRefsDoc.arr[1]).toBe(docRef2.path)
    expect(noRefsDoc.arr[2]).toBe(docRef.path)
    expect(refs).toEqual({
      'arr.0': docRef,
      'arr.1': docRef2,
      'arr.2': docRef,
    })
  })

  it('keeps non enumerable properties', () => {
    const obj = {}
    Object.defineProperty(obj, 'bar', {
      value: 'foo',
      enumerable: false,
    })
    const [noRefsDoc, refs] = extractRefs(obj, undefined, {})
    expect(Object.getOwnPropertyDescriptor(noRefsDoc, 'bar')).toEqual({
      value: 'foo',
      enumerable: false,
      configurable: false,
      writable: false,
    })
    expect(refs).toEqual({})
  })
})
