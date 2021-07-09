import firebase from 'firebase'
import { bindDocument, FirestoreOptions } from '../../../src/core'
import {
  delay,
  spyUnbind,
  spyOnSnapshot,
  spyOnSnapshotCallback,
  createOps,
  initFirebase,
  generateRandomID,
} from '../../src'
import * as firestore from '@firebase/firestore-types'
import { OperationsType } from '../../../src/shared'
import { ref, watch } from 'vue'

const buildRefs = () => ({
  items: ref(),
  item: ref(),
  a: ref(),
  b: ref(),
  c: ref(),
  d: ref(),
})

beforeAll(() => {
  initFirebase()
})

describe('refs in documents', () => {
  // a and c existing objects { isA: true }
  // item is an empty ready to use object
  // empty is an empty object that is left empty
  // d has a ref to c
  let collection: firestore.CollectionReference,
    a: firestore.DocumentReference,
    b: firestore.DocumentReference,
    c: firestore.DocumentReference,
    d: firestore.DocumentReference,
    empty: firestore.DocumentReference,
    item: firestore.DocumentReference,
    target: ReturnType<typeof buildRefs>,
    bind: (
      key: keyof ReturnType<typeof buildRefs>,
      document: firestore.DocumentReference,
      options?: FirestoreOptions
    ) => Promise<void>,
    unbind: () => void,
    ops: OperationsType

  beforeEach(async () => {
    target = buildRefs()
    ops = createOps()
    collection = firebase.firestore().collection(generateRandomID())
    a = collection.doc()
    b = collection.doc()

    empty = collection.doc()
    item = collection.doc()

    c = collection.doc()
    d = collection.doc()

    await a.set({ isA: true })
    await c.set({ isC: true })
    await d.set({ ref: c })

    bind = (key, document, options) => {
      return new Promise(
        (resolve, reject) =>
          (unbind = bindDocument(
            target[key],
            document,
            ops,
            resolve,
            reject,
            options
          ))
      )
    }

    await Promise.all([bind('c', c), bind('d', d)])

    // wait for refs to be ready as well
    await delay(5)
    /* ops.set.mockClear()
    ops.add.mockClear()
    ops.remove.mockClear() */
  })

  it('item should be removed from binding when theres an arrays of refs', async () => {
    const arr = collection.doc()
    target.items.value = null

    await arr.set({ refs: [a, b, c] })
    await bind('items', arr, { maxRefDepth: 0 })
    await arr.update({ refs: [b, c] })

    expect(target.items.value).toEqual({ refs: [b.path, c.path] })
  })

  it('keeps correct elements in array of references when removing in the middle', async () => {
    const arr = collection.doc()
    target.items.value = null

    await arr.set({ refs: [a, b, c] })
    await bind('items', arr, { maxRefDepth: 0 })
    await arr.update({ refs: [a, c] })

    expect(target.items.value).toEqual({ refs: [a.path, c.path] })
  })

  it('binds refs on documents', async () => {
    // create an empty doc and update using the ref instead of plain data
    await item.set({ ref: c })
    await bind('item', item)

    expect(ops.set).toHaveBeenCalledTimes(2)
    expect(ops.set).toHaveBeenNthCalledWith(
      1,
      target.item,
      'value',
      target.item.value
    )
    expect(ops.set).toHaveBeenNthCalledWith(
      2,
      target.item,
      'value.ref',
      target.item.value.ref
    )

    expect(target.item.value).toEqual({
      ref: { isC: true },
    })
  })

  it('does not lose empty references in objects when updating a property', async () => {
    const emptyItem = collection.doc()
    await item.set({ o: { ref: emptyItem }, toggle: true })
    await bind('item', item)
    expect(target.item.value).toEqual({
      o: { ref: null },
      toggle: true,
    })
    await item.update({ toggle: false })
    expect(target.item.value).toEqual({
      o: { ref: null },
      toggle: false,
    })
  })

  it('does not lose empty references in arrays when updating a property', async () => {
    const emptyItem = collection.doc()
    await item.set({ a: [emptyItem], toggle: true })
    await bind('item', item)
    expect(target.item.value).toEqual({
      a: [null],
      toggle: true,
    })
    await item.update({ toggle: false })
    expect(target.item.value).toEqual({
      a: [null],
      toggle: false,
    })
  })

  it('does not lose empty references in arrays of objects when updating a property', async () => {
    const emptyItem = collection.doc()
    await item.set({ todos: [{ ref: emptyItem }], toggle: true })
    await bind('item', item)
    expect(target.item.value).toEqual({
      todos: [{ ref: null }],
      toggle: true,
    })
    await item.update({ toggle: false })
    expect(target.item.value).toEqual({
      todos: [{ ref: null }],
      toggle: false,
    })
  })

  it('keeps array of references when updating a property', async () => {
    await item.set({ a: [a, b, c, { foo: 'bar' }], toggle: true })
    await bind('item', item)
    expect(target.item.value).toEqual({
      a: [{ isA: true }, null, { isC: true }, { foo: 'bar' }],
      toggle: true,
    })
    await item.update({ toggle: false })
    expect(target.item.value).toEqual({
      a: [{ isA: true }, null, { isC: true }, { foo: 'bar' }],
      toggle: false,
    })
  })

  it('binds refs nested in documents (objects)', async () => {
    await item.set({
      obj: {
        ref: c,
      },
    })
    await bind('item', item)

    expect(ops.set).toHaveBeenCalledTimes(2)
    expect(ops.set).toHaveBeenNthCalledWith(
      1,
      target.item,
      'value',
      target.item.value
    )
    expect(ops.set).toHaveBeenNthCalledWith(
      2,
      target.item,
      'value.obj.ref',
      target.item.value.obj.ref
    )

    expect(target.item.value).toEqual({
      obj: {
        ref: { isC: true },
      },
    })
  })

  it('binds refs deeply nested in documents (objects)', async () => {
    await item.set({
      obj: {
        nested: {
          ref: c,
        },
      },
    })
    await bind('item', item)

    expect(ops.set).toHaveBeenCalledTimes(2)
    expect(ops.set).toHaveBeenNthCalledWith(
      1,
      target.item,
      'value',
      target.item.value
    )
    expect(ops.set).toHaveBeenNthCalledWith(
      2,
      target.item,
      'value.obj.nested.ref',
      target.item.value.obj.nested.ref
    )

    expect(target.item.value).toEqual({
      obj: {
        nested: {
          ref: {
            isC: true,
          },
        },
      },
    })
  })

  it('update inner ref', async () => {
    expect(target.d.value).toEqual({
      ref: {
        isC: true,
      },
    })

    await c.update({ isC: false })

    expect(ops.set).toHaveBeenCalledTimes(2)
    // the first call is pretty much irrelevant but included in case
    // one day it breaks and I need to know why
    expect(ops.set).toHaveBeenNthCalledWith(
      1,
      target.c,
      'value',
      target.c.value
    )
    expect(ops.set).toHaveBeenNthCalledWith(
      2,
      target.d,
      'value.ref',
      target.d.value.ref
    )

    expect(target.d.value).toEqual({
      ref: {
        isC: false,
      },
    })
  })

  it('is null if ref does not exist', async () => {
    await d.update({ ref: empty })

    // NOTE(1) need to wait because we updated with a ref
    await delay(5)

    expect(ops.set).toHaveBeenNthCalledWith(2, target.d, 'value.ref', null)

    expect(target.d.value).toEqual({
      ref: null,
    })
  })

  it('unbinds previously bound document when overwriting a bound', async () => {
    // Mock c onSnapshot to spy when the callback is called
    const spy = spyOnSnapshotCallback(item)
    await item.set({ baz: 'baz' })
    await d.update({ ref: item })
    // NOTE see #1
    await delay(5)
    expect(spy).toHaveBeenCalledTimes(1)
    await item.update({ baz: 'bar' })
    // make sure things are updating correctly
    expect(target.d.value).toEqual({
      ref: { baz: 'bar' },
    })
    // we call update twice to make sure our mock works
    expect(spy).toHaveBeenCalledTimes(2)
    await d.update({ ref: b })
    // NOTE see #1
    await delay(5)

    expect(target.d.value).toEqual({
      ref: null,
    })
    await item.update({ foo: 'bar' })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(target.d.value).toEqual({
      ref: null,
    })
    spy.mockRestore()
  })

  it('does not rebind if it is the same ref', async () => {
    const spy = spyOnSnapshot(item)
    await item.set({ baz: 'baz' })
    await d.update({ ref: item })
    // NOTE see #1
    await delay(5)
    expect(spy).toHaveBeenCalledTimes(1)

    await d.update({ ref: item })
    await delay(5)

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('resolves the promise when refs are resolved in a document', async () => {
    await item.set({ ref: a })

    await bind('item', item)
    expect(target.item.value).toEqual({ ref: { isA: true } })
  })

  it('resolves the promise when nested refs are resolved in a document', async () => {
    await item.set({ ref: a })
    await d.update({ ref: item })

    await bind('item', d)
    expect(target.item.value).toEqual({ ref: { ref: { isA: true } } })
  })

  it('resolves the promise when nested non-existant refs are resolved in a document', async () => {
    await item.set({ ref: empty })
    await d.update({ ref: item })

    await bind('item', d)
    expect(target.item.value).toEqual({ ref: { ref: null } })
  })

  it('resolves the promise when the document does not exist', async () => {
    expect(target.item.value).toEqual(undefined)
    await bind('item', empty)
    expect(target.item.value).toBe(null)
  })

  it('unbinds all refs when the document is unbound', async () => {
    const cSpy = spyUnbind(c)
    const dSpy = spyUnbind(d)
    // rebind to use the spies
    await bind('d', d)
    expect(target.d.value).toEqual({
      ref: {
        isC: true,
      },
    })
    unbind()

    expect(dSpy).toHaveBeenCalledTimes(1)
    expect(cSpy).toHaveBeenCalledTimes(1)

    cSpy.mockRestore()
    dSpy.mockRestore()
  })

  it('unbinds nested refs when the document is unbound', async () => {
    const aSpy = spyUnbind(a)
    const cSpy = spyUnbind(b)
    const dSpy = spyUnbind(item)

    await b.set({ ref: a })
    await item.set({ ref: b })

    await bind('item', item)
    unbind()

    expect(dSpy).toHaveBeenCalledTimes(1)
    expect(cSpy).toHaveBeenCalledTimes(1)
    expect(aSpy).toHaveBeenCalledTimes(1)

    aSpy.mockRestore()
    cSpy.mockRestore()
    dSpy.mockRestore()
  })

  it('unbinds multiple refs when the document is unbound', async () => {
    const aSpy = spyUnbind(a)
    const cSpy = spyUnbind(c)
    const dSpy = spyUnbind(item)

    await item.set({ c, a })

    await bind('item', item)
    unbind()

    expect(dSpy).toHaveBeenCalledTimes(1)
    expect(cSpy).toHaveBeenCalledTimes(1)
    expect(aSpy).toHaveBeenCalledTimes(1)

    aSpy.mockRestore()
    cSpy.mockRestore()
    dSpy.mockRestore()
  })

  it('unbinds when a ref is replaced', async () => {
    const aSpy = spyUnbind(a)
    const cSpy = spyUnbind(c)
    const dSpy = spyUnbind(d)

    await bind('d', d)
    expect(target.d.value).toEqual({
      ref: {
        isC: true,
      },
    })

    await d.update({ ref: a })
    // NOTE see #1
    await delay(5)
    expect(target.d.value).toEqual({
      ref: {
        isA: true,
      },
    })

    // expect(dSpy.mock.calls.length).toBe(1)
    expect(cSpy).toHaveBeenCalledTimes(1)
    expect(aSpy).toHaveBeenCalledTimes(0)

    aSpy.mockRestore()
    cSpy.mockRestore()
    dSpy.mockRestore()
  })

  it('unbinds removed properties', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const unbindSpy = spyUnbind(a)
    const callbackSpy = spyOnSnapshotCallback(a)
    const onSnapshotSpy = spyOnSnapshot(a)

    const item = firebase.firestore().collection(generateRandomID()).doc()
    await a.set({ isA: true })
    await b.set({ isB: true })
    await item.set({ a })

    expect(unbindSpy).toHaveBeenCalledTimes(0)
    expect(callbackSpy).toHaveBeenCalledTimes(0)
    expect(onSnapshotSpy).toHaveBeenCalledTimes(0)
    await bind('item', item)

    expect(unbindSpy).toHaveBeenCalledTimes(0)
    expect(callbackSpy).toHaveBeenCalledTimes(1)
    expect(onSnapshotSpy).toHaveBeenCalledTimes(1)

    await item.set({ b })
    await a.update({ newA: true })
    // NOTE see #1
    await delay(5)

    expect(unbindSpy).toHaveBeenCalledTimes(1)
    expect(callbackSpy).toHaveBeenCalledTimes(1)
    expect(onSnapshotSpy).toHaveBeenCalledTimes(1)

    unbindSpy.mockRestore()
    callbackSpy.mockRestore()
    onSnapshotSpy.mockRestore()
  })

  it('binds refs on arrays', async () => {
    const item = firebase.firestore().collection(generateRandomID()).doc()
    await b.set({ isB: true })

    await item.set({
      arr: [a, b, a],
    })

    await bind('item', item)

    expect(target.item.value).toEqual({
      arr: [{ isA: true }, { isB: true }, { isA: true }],
    })
  })

  it('properly updates a document with refs', async () => {
    await item.set({ a })
    await bind('item', item)

    expect(target.item.value).toEqual({
      a: { isA: true },
    })

    await item.update({ newThing: true })

    // NOTE see (1)
    await delay(5)

    expect(target.item.value).toEqual({
      newThing: true,
      a: { isA: true },
    })
  })

  it('updates values in arrays', async () => {
    await item.set({
      arr: [a, b],
    })

    await bind('item', item)

    expect(target.item.value).toEqual({
      arr: [{ isA: true }, null],
    })

    await b.set({ isB: true })

    expect(target.item.value).toEqual({
      arr: [{ isA: true }, { isB: true }],
    })

    await item.update({
      arr: [c],
    })

    // NOTE see (1)
    await delay(5)

    expect(target.item.value).toEqual({
      arr: [{ isC: true }],
    })
  })

  // TODO move to vuefire
  it.skip('correctly updates arrays', async () => {
    await item.set({
      arr: [a, b],
    })

    await bind('item', item)

    const spy = jest.fn()
    watch(() => target.item.value && target.item.value.arr, spy)

    await b.update({ isB: true })

    expect(spy).toHaveBeenCalledTimes(1)

    await item.update({
      arr: [c],
    })

    expect(spy).toHaveBeenCalledTimes(2)

    // NOTE see (1)
    await delay(5)

    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('respects provided maxRefDepth', async () => {
    await item.set({ a })
    await a.set({ b })
    await b.set({ c })
    await d.set({ isD: true })
    await c.set({ d })

    await bind('item', item, { maxRefDepth: 1 })
    expect(target.item.value).toEqual({
      a: {
        b: b.path,
      },
    })

    await bind('item', item, { maxRefDepth: 3 })
    expect(target.item.value).toEqual({
      a: {
        b: {
          c: {
            d: d.path,
          },
        },
      },
    })
  })

  it('does not fail with cyclic refs', async () => {
    await item.set({ item })
    await bind('item', item, { maxRefDepth: 5 })

    expect(target.item.value).toEqual({
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
    })
  })
})
