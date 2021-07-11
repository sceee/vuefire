import firebase from 'firebase'
import { bindCollection, FirestoreOptions } from '../../../src/core'
import {
  delay,
  spyUnbind,
  delayUpdate,
  createOps,
  initFirebase,
  generateRandomID,
} from '../../src'
import { OperationsType } from '../../../src/shared'
import * as firestore from '@firebase/firestore-types'
import { ref } from 'vue'

const buildRefs = () => ({
  items: ref(),
  a: ref(),
  b: ref(),
  c: ref(),
})

beforeAll(() => {
  initFirebase()
})

describe('refs in collections', () => {
  let collection: firestore.CollectionReference,
    a: firestore.DocumentReference,
    b: firestore.DocumentReference,
    target: ReturnType<typeof buildRefs>,
    bind: (
      key: keyof ReturnType<typeof buildRefs>,
      collection: firestore.CollectionReference,
      options?: FirestoreOptions
    ) => Promise<void>,
    unbind: () => void,
    ops: OperationsType,
    first: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>

  beforeEach(async () => {
    target = buildRefs()
    ops = createOps()
    bind = (key, collection, options) => {
      return new Promise(
        (resolve, reject) =>
          (unbind = bindCollection(
            target[key],
            collection,
            ops,
            resolve,
            reject,
            options
          ))
      )
    }
    a = firebase.firestore().collection(generateRandomID()).doc()
    b = firebase.firestore().collection(generateRandomID()).doc()
    await a.set({ isA: true })
    await b.set({ isB: true })
    collection = firebase.firestore().collection(generateRandomID())
    first = await collection.add({ ref: a })
    await collection.add({ ref: b })
  })

  it('binds refs on collections', async () => {
    await bind('items', collection)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([{ ref: { isA: true } }, { ref: { isB: true } }])
    )
  })

  it('waits for array to be fully populated', async () => {
    const c = firebase.firestore().collection(generateRandomID()).doc()
    await c.set({ isC: true })
    await collection.add({ ref: c })
    // force callback delay

    delayUpdate(c)
    const data = await bind('items', collection)

    expect(data).toEqual(target.items.value)
    expect(target.items.value).toHaveLength(3)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        { ref: { isA: true } },
        { ref: { isB: true } },
        { ref: { isC: true } },
      ])
    )
  })

  it('binds refs when adding to collection', async () => {
    await bind('items', collection)
    const c = firebase.firestore().collection(generateRandomID()).doc()
    await c.set({ isC: true })

    await collection.add({ ref: c })
    // wait for refs to update
    await delay(5)

    expect(target.items.value).toHaveLength(3)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        { ref: { isA: true } },
        { ref: { isB: true } },
        { ref: { isC: true } },
      ])
    )
  })

  it('unbinds refs when the collection is unbound', async () => {
    const items = firebase.firestore().collection(generateRandomID())
    const spyA = spyUnbind(a)
    const spyB = spyUnbind(b)
    await items.add({ ref: a })
    await items.add({ ref: b })
    await bind('items', items)

    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(0)
    expect(spyB).toHaveBeenCalledTimes(0)

    unbind()

    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(1)
    expect(spyB).toHaveBeenCalledTimes(1)

    spyA.mockRestore()
    spyB.mockRestore()
  })

  it('unbinds nested refs when the collection is unbound', async () => {
    const items = firebase.firestore().collection(generateRandomID())
    const spyA = spyUnbind(a)
    await items.add({ ref: { ref: a } })
    await bind('items', items)
    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(0)

    unbind()
    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(1)

    spyA.mockRestore()
  })

  it('unbinds refs when items are removed', async () => {
    const spyA = spyUnbind(a)
    await bind('items', collection)
    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(0)

    const idToDelete = target.items.value[0].id
    console.log(`Deleting ${idToDelete}`)
    await collection.doc(idToDelete).delete()

    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(1)

    spyA.mockRestore()
  })

  it('unbinds refs when items are modified', async () => {
    const spyA = spyUnbind(a)
    await bind('items', collection)
    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(0)

    await first.set({ b })

    await delay(200)

    expect(spyA).toHaveBeenCalledTimes(1)

    spyA.mockRestore()
  })

  it('updates when modifying an item', async () => {
    await bind('items', collection)

    await first.update({ newThing: true })
    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        { ref: { isA: true }, newThing: true },
        { ref: { isB: true } },
      ])
    )
  })

  it('keeps old data of refs when modifying an item', async () => {
    await bind('items', collection)
    await first.update({ newThing: true })

    expect(target.items.value).toEqual(
      expect.arrayContaining([
        {
          ref: { isA: true },
          newThing: true,
        },
      ])
    )
  })

  it('does not lose empty references in objects when updating a property', async () => {
    const items = firebase.firestore().collection(generateRandomID())
    const emptyItem = collection.doc()

    const item = await items.add({ o: { ref: emptyItem }, toggle: true })
    await bind('items', items)
    await delay(200)

    expect(target.items.value).toEqual([
      {
        o: { ref: null },
        toggle: true,
      },
    ])
    await items.add({ foo: 'bar' })

    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        { foo: 'bar' },
        {
          o: { ref: null },
          toggle: true,
        },
      ])
    )
    await item.set({ toggle: false }, { merge: true })

    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        {
          o: { ref: null },
          toggle: false,
        },
        { foo: 'bar' },
      ])
    )
  })

  it('does not lose empty references in arrays when updating a property', async () => {
    const items = firebase.firestore().collection(generateRandomID())
    const emptyItem = collection.doc(generateRandomID())

    const item = await items.add({ a: [emptyItem], toggle: true })
    await bind('items', items)

    await delay(200)

    expect(target.items.value).toEqual([
      {
        a: [null],
        toggle: true,
      },
    ])
    await items.add({ foo: 'bar' })

    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        {
          a: [null],
          toggle: true,
        },
        { foo: 'bar' },
      ])
    )
    await item.set({ toggle: false }, { merge: true })

    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        {
          a: [null],
          toggle: false,
        },
        { foo: 'bar' },
      ])
    )
  })

  it('keeps array of references when updating a property', async () => {
    const items = firebase.firestore().collection(generateRandomID())
    const c = collection.doc()
    const item = await items.add({ a: [a, b, c, { foo: 'bar' }], toggle: true })
    await bind('items', items)
    expect(target.items.value).toEqual([
      {
        a: [{ isA: true }, { isB: true }, null, { foo: 'bar' }],
        toggle: true,
      },
    ])
    await items.add({ foo: 'bar' })

    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        {
          a: [{ isA: true }, { isB: true }, null, { foo: 'bar' }],
          toggle: true,
        },
        { foo: 'bar' },
      ])
    )
    await item.update({ toggle: false })

    await delay(200)

    expect(target.items.value).toHaveLength(2)
    expect(target.items.value).toEqual(
      expect.arrayContaining([
        {
          a: [{ isA: true }, { isB: true }, null, { foo: 'bar' }],
          toggle: false,
        },
        { foo: 'bar' },
      ])
    )
  })

  it('respects provided maxRefDepth', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    const c = firebase.firestore().collection(generateRandomID()).doc()
    const d = firebase.firestore().collection(generateRandomID()).doc()
    await a.set({ b })
    await b.set({ c })
    await d.set({ isD: true })
    await c.set({ d })
    const collection = firebase.firestore().collection(generateRandomID())
    await collection.add({ a })

    await bind('items', collection, { maxRefDepth: 1 })
    expect(target.items.value).toEqual([
      {
        a: {
          b: b.path,
        },
      },
    ])

    await bind('items', collection, { maxRefDepth: 3 })
    expect(target.items.value).toEqual([
      {
        a: {
          b: {
            c: {
              d: d.path,
            },
          },
        },
      },
    ])
  })

  it('does not fail with cyclic refs', async () => {
    const item = firebase.firestore().collection(generateRandomID()).doc()
    await item.set({ item })
    const collection = firebase.firestore().collection(generateRandomID())
    await collection.add({ item })
    await bind('items', collection, { maxRefDepth: 5 })

    expect(target.items.value).toEqual([
      {
        // it's easy to see we stop at 5 and we have 5 brackets
        item: {
          item: {
            item: {
              item: {
                item: {
                  item: item.path,
                },
              },
            },
          },
        },
      },
    ])
  })
})
