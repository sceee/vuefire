import firebase from 'firebase'
import { firestorePlugin } from '../../../src'
import { tick, delayUpdate, initFirebase, generateRandomID } from '../../src'
import * as firestore from '@firebase/firestore-types'
import { ComponentPublicInstance } from 'vue'
import { mount, VueWrapper } from '@vue/test-utils'

beforeAll(() => {
  initFirebase()
})

describe('Firestore: binding', () => {
  let collection: firestore.CollectionReference
  let document: firestore.DocumentReference
  let vm: ComponentPublicInstance & { items: any[]; item: any }
  let wrapper: VueWrapper<ComponentPublicInstance & { items: any[]; item: any }>
  beforeEach(async () => {
    collection = firebase.firestore().collection(generateRandomID())
    document = collection.doc()

    wrapper = mount(
      {
        template: 'no',
        // purposely set items as null
        // but it's a good practice to set it to an empty array
        data: () => ({
          items: null,
          item: null,
        }),
      },
      { global: { plugins: [firestorePlugin] } }
    )
    await tick()
    vm = wrapper.vm
  })

  it('manually binds a collection', async () => {
    expect(vm.items).toEqual(null)
    await vm.$bind('items', collection)
    expect(vm.items).toEqual([])
    await collection.add({ text: 'foo' })
    expect(vm.items).toEqual([{ text: 'foo' }])
  })

  it('manually binds a document', async () => {
    expect(vm.item).toEqual(null)
    await vm.$bind('item', document)
    expect(vm.item).toEqual(null)
    await document.set({ text: 'foo' })
    expect(vm.item).toEqual({ text: 'foo' })
  })

  it('removes items', async () => {
    await collection.add({ name: 'one' })
    await collection.add({ name: 'two' })

    await vm.$bind('items', collection)
    await collection.doc(vm.items.find((i) => i.name === 'two').id).delete()
    expect(vm.items).toEqual([{ name: 'one' }])
  })

  it('returs a promise', () => {
    expect(vm.$bind('items', collection) instanceof Promise).toBe(true)
    expect(vm.$bind('item', document) instanceof Promise).toBe(true)
  })

  it('unbinds previously bound refs', async () => {
    await document.set({ foo: 'foo' })
    const doc2 = firebase.firestore().collection(generateRandomID()).doc()
    await doc2.set({ bar: 'bar' })
    await vm.$bind('item', document)
    expect(vm.$firestoreRefs.item).toBe(document)
    expect(vm.item).toEqual({ foo: 'foo' })
    await vm.$bind('item', doc2)
    expect(vm.item).toEqual({ bar: 'bar' })
    await document.update({ foo: 'baz' })
    expect(vm.$firestoreRefs.item).toBe(doc2)
    expect(vm.item).toEqual({ bar: 'bar' })
  })

  it('waits for all refs in document', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    delayUpdate(b)
    await document.set({ a, b })

    await vm.$bind('item', document)

    expect(vm.item).toEqual({
      a: null,
      b: null,
    })
  })

  test('waits for all refs in document with interrupting by new ref', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    const c = firebase.firestore().collection(generateRandomID()).doc()
    delayUpdate(b)
    await document.set({ a, b })

    const promise = vm.$bind('item', document)

    await document.update({ c })

    await promise

    expect(vm.item).toEqual({
      a: null,
      b: null,
      c: null,
    })
  })

  it('waits for all refs in collection', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    delayUpdate(b)
    await collection.add({ a })
    await collection.add({ b })

    await vm.$bind('items', collection)

    expect(vm.items).toHaveLength(2)
    expect(vm.items).toEqual(expect.arrayContaining([{ b: null }, { a: null }]))
  })

  it('waits for nested refs in document', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    const c = firebase.firestore().collection(generateRandomID()).doc()
    await b.set({ c })
    delayUpdate(b)
    delayUpdate(c, 5)
    await document.set({ a, b })

    await vm.$bind('item', document)

    expect(vm.item).toEqual({
      a: null,
      b: { c: null },
    })
  })

  it('waits for nested refs with data in document', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    const c = firebase.firestore().collection(generateRandomID()).doc()
    await a.set({ isA: true })
    await c.set({ isC: true })
    await b.set({ c })
    delayUpdate(b)
    delayUpdate(c, 5)
    await document.set({ a, b })

    await vm.$bind('item', document)

    expect(vm.item).toEqual({
      a: { isA: true },
      b: { c: { isC: true } },
    })
  })

  it('waits for nested refs in collections', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    const c = firebase.firestore().collection(generateRandomID()).doc()
    await b.set({ c })
    delayUpdate(b)
    delayUpdate(c, 5)
    await collection.add({ a })
    await collection.add({ b })

    await vm.$bind('items', collection)

    expect(vm.items).toHaveLength(2)
    expect(vm.items).toEqual(
      expect.arrayContaining([{ a: null }, { b: { c: null } }])
    )
  })

  it('waits for nested refs with data in collections', async () => {
    const a = firebase.firestore().collection(generateRandomID()).doc()
    const b = firebase.firestore().collection(generateRandomID()).doc()
    const c = firebase.firestore().collection(generateRandomID()).doc()
    await a.set({ isA: true })
    await c.set({ isC: true })
    await b.set({ c })
    delayUpdate(b)
    delayUpdate(c, 5)
    await collection.add({ a })
    await collection.add({ b })

    await vm.$bind('items', collection)

    expect(vm.items).toHaveLength(2)
    expect(vm.items).toEqual(
      expect.arrayContaining([
        { a: { isA: true } },
        { b: { c: { isC: true } } },
      ])
    )
  })

  it('can customize the reset option through $bind', async () => {
    await document.set({ foo: 'foo' })
    const doc2 = firebase.firestore().collection(generateRandomID()).doc()
    await doc2.set({ bar: 'bar' })
    await vm.$bind('item', document)
    expect(vm.item).toEqual({ foo: 'foo' })
    const p = vm.$bind('item', doc2, { reset: false })
    expect(vm.item).toEqual({ foo: 'foo' })
    await p
    expect(vm.item).toEqual({ bar: 'bar' })
    await vm.$bind('item', document)
    expect(vm.item).toEqual(null)
  })

  it('can customize the reset option through $unbind', async () => {
    await document.set({ foo: 'foo' })
    const doc2 = firebase.firestore().collection(generateRandomID()).doc()
    await doc2.set({ bar: 'bar' })
    await vm.$bind('item', document)
    vm.$unbind('item', false)
    expect(vm.item).toEqual({ foo: 'foo' })
    // the reset option should have no effect on the latter unbind
    await vm.$bind('item', document, { reset: () => ({ bar: 'bar' }) })
    vm.$unbind('item')
    expect(vm.item).toEqual(null)
  })

  it('do not reset if wait: true', async () => {
    await collection.add({ foo: 'foo' })
    await vm.$bind('items', collection)
    const col2 = firebase.firestore().collection(generateRandomID())
    await col2.add({ bar: 'bar' })
    const p = vm.$bind('items', col2, { wait: true, reset: true })
    expect(vm.items).toEqual([{ foo: 'foo' }])
    await p
    expect(vm.items).toEqual([{ bar: 'bar' }])
  })

  it('wait + reset can be overriden with a function', async () => {
    await collection.add({ foo: 'foo' })
    await vm.$bind('items', collection)
    const col2 = firebase.firestore().collection(generateRandomID())
    await col2.add({ bar: 'bar' })
    const p = vm.$bind('items', col2, { wait: true, reset: () => ['foo'] })
    expect(vm.items).toEqual(['foo'])
    await p
    expect(vm.items).toEqual([{ bar: 'bar' }])
  })
})
