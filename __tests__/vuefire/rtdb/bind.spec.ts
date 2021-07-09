import firebase from 'firebase'
import { mount } from '@vue/test-utils'
import { rtdbPlugin } from '../../../src'
import { generateRandomID, initFirebase, tick } from '../../src'

beforeAll(() => {
  initFirebase()
})

describe('RTDB: manual bind', () => {
  async function factory() {
    const source = firebase.database().ref(generateRandomID())
    const wrapper = mount(
      {
        template: 'no',
        // purposely set items as null
        // but it's a good practice to set it to an empty array
        data: () => ({
          items: [],
          item: null,
        }),
      },
      {
        global: {
          plugins: [rtdbPlugin],
        },
      }
    )

    await tick()

    return { wrapper, source }
  }

  it('manually binds as an array', async () => {
    const { wrapper, source } = await factory()
    expect(wrapper.vm.items).toEqual([])
    const promise = wrapper.vm.$rtdbBind('items', source)
    expect(wrapper.vm.items).toEqual([])
    await source.push({ text: 'foo' })
    //source.flush()
    await promise
    expect(wrapper.vm.items).toEqual([{ text: 'foo' }])
  })

  it('removes children in arrays', async () => {
    const { wrapper, source } = await factory()
    //source.autoFlush()
    await source.push({ name: 'one' })
    await source.push({ name: 'two' })

    await wrapper.vm.$rtdbBind('items', source)
    await source.child(wrapper.vm.items[1]['.key']).remove()
    expect(wrapper.vm.items).toEqual([{ name: 'one' }])
  })

  it('returs a promise', async () => {
    const { wrapper, source } = await factory()
    expect(wrapper.vm.$rtdbBind('items', source) instanceof Promise).toBe(true)
    expect(wrapper.vm.$rtdbBind('item', source) instanceof Promise).toBe(true)
  })

  it('manually binds as an object', async () => {
    const { wrapper, source } = await factory()
    expect(wrapper.vm.item).toEqual(null)
    const promise = wrapper.vm.$rtdbBind('item', source)
    expect(wrapper.vm.item).toEqual(null)
    await source.set({ text: 'foo' })
    //source.flush()
    await promise
    expect(wrapper.vm.item).toEqual({ text: 'foo' })
  })

  it('unbinds when overriting existing bindings', async () => {
    const { wrapper, source } = await factory()
    //source.autoFlush()
    await source.set({ name: 'foo' })
    await wrapper.vm.$rtdbBind('item', source)
    expect(wrapper.vm.item).toEqual({ name: 'foo' })
    const other = firebase.database().ref(generateRandomID())
    //other.autoFlush()
    await other.set({ name: 'bar' })
    await wrapper.vm.$rtdbBind('item', other)
    expect(wrapper.vm.item).toEqual({ name: 'bar' })

    await source.set({ name: 'new foo' })
    expect(wrapper.vm.item).toEqual({ name: 'bar' })
  })

  it('manually unbinds a ref', async () => {
    const { wrapper, source } = await factory()
    //source.autoFlush()
    await source.set({ name: 'foo' })
    await wrapper.vm.$rtdbBind('item', source)
    expect(wrapper.vm.item).toEqual({ name: 'foo' })
    wrapper.vm.$rtdbUnbind('item')
    await source.set({ name: 'bar' })
    expect(wrapper.vm.item).toEqual(null)
  })

  it('can customize the reset option through $rtdbBind', async () => {
    const { wrapper, source } = await factory()
    const otherSource = firebase.database().ref(generateRandomID())
    await source.set({ name: 'foo' })
    await otherSource.set({ name: 'bar' })
    let p = wrapper.vm.$rtdbBind('item', source)
    //source.flush()
    await p
    p = wrapper.vm.$rtdbBind('item', otherSource, { reset: false })
    expect(wrapper.vm.item).toEqual({ name: 'foo' })
    //otherSource.flush()
    await p
    expect(wrapper.vm.item).toEqual({ name: 'bar' })
    // should not apply last used option
    p = wrapper.vm.$rtdbBind('item', source)
    expect(wrapper.vm.item).toEqual(null)
    //source.flush()
  })

  it('can customize the reset option through $rtdbUnbind', async () => {
    const { wrapper, source } = await factory()
    //source.autoFlush()
    await source.set({ name: 'foo' })
    const otherSource = firebase.database().ref(generateRandomID())
    await otherSource.set({ name: 'bar' })
    //otherSource.autoFlush()
    await wrapper.vm.$rtdbBind('item', source)
    expect(wrapper.vm.item).toEqual({ name: 'foo' })
    wrapper.vm.$rtdbUnbind('item', false)
    expect(wrapper.vm.item).toEqual({ name: 'foo' })
    // should not apply the option to the next unbind call
    await wrapper.vm.$rtdbBind('item', otherSource, { reset: false })
    expect(wrapper.vm.item).toEqual({ name: 'bar' })
    wrapper.vm.$rtdbUnbind('item')
    expect(wrapper.vm.item).toEqual(null)
  })

  it('do not reset if wait: true', async () => {
    const { wrapper, source } = await factory()
    const otherSource = firebase.database().ref(generateRandomID())

    // source.autoFlush()
    let p = wrapper.vm.$rtdbBind('items', source)
    await source.push({ name: 'foo' })
    //source.flush()
    await p
    p = wrapper.vm.$rtdbBind('items', otherSource, { wait: true, reset: true })
    expect(wrapper.vm.items).toEqual([{ name: 'foo' }])
    await otherSource.push({ name: 'bar' })
    //otherSource.flush()
    await p
    expect(wrapper.vm.items).toEqual([{ name: 'bar' }])
  })

  it('wait + reset can be overriden with a function', async () => {
    const { wrapper, source } = await factory()
    const otherSource = firebase.database().ref(generateRandomID())

    // source.autoFlush()
    let p = wrapper.vm.$rtdbBind('items', source)
    await source.push({ name: 'foo' })
    //source.flush()
    await p
    // using an array is important as we use that to choose between bindAsObject and bindAsArray
    p = wrapper.vm.$rtdbBind('items', otherSource, {
      wait: true,
      reset: () => ['foo'],
    })
    expect(wrapper.vm.items).toEqual(['foo'])
    await otherSource.push({ name: 'bar' })
    //otherSource.flush()
    await p
    expect(wrapper.vm.items).toEqual([{ name: 'bar' }])
  })
})
