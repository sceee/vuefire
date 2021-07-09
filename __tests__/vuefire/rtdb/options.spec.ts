import firebase from 'firebase'
import { mount } from '@vue/test-utils'
import { rtdbPlugin } from '../../../src'
import { generateRandomID, initFirebase } from '../../src'

beforeAll(() => {
  initFirebase()
})

describe('RTDB: plugin options', () => {
  it('allows customizing $rtdbBind', () => {
    const wrapper = mount(
      { template: 'n' },
      {
        global: {
          plugins: [
            [
              rtdbPlugin,
              {
                bindName: '$myBind',
                unbindName: '$myUnbind',
              },
            ],
          ],
        },
      }
    )
    expect(typeof (wrapper.vm as any).$myBind).toBe('function')
    expect(typeof (wrapper.vm as any).$myUnbind).toBe('function')
  })

  it('calls custom serialize function with collection', async () => {
    const pluginOptions = {
      serialize: jest.fn(() => ({ foo: 'bar' })),
    }
    const { vm } = mount(
      {
        template: 'no',
        data: () => ({ items: [] }),
      },
      {
        global: {
          plugins: [[rtdbPlugin, pluginOptions]],
        },
      }
    )

    const items = firebase.database().ref(generateRandomID())

    const p = vm.$rtdbBind('items', items)
    await items.push({ text: 'foo' })
    //items.flush()

    await p

    expect(pluginOptions.serialize).toHaveBeenCalledTimes(1)
    expect(pluginOptions.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ val: expect.any(Function) })
    )
    expect(vm.items).toEqual([{ foo: 'bar' }])
  })

  it('can be ovrriden by local option', async () => {
    const pluginOptions = {
      serialize: jest.fn(() => ({ foo: 'bar' })),
    }

    const items = firebase.database().ref(generateRandomID())
    const { vm } = mount(
      {
        template: 'no',
        data: () => ({ items: [] }),
      },
      {
        global: {
          plugins: [[rtdbPlugin, pluginOptions]],
        },
      }
    )

    const spy = jest.fn(() => ({ bar: 'bar' }))

    const p = vm.$rtdbBind('items', items, { serialize: spy })
    await items.push({ text: 'foo' })
    //items.flush()

    await p

    expect(pluginOptions.serialize).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ val: expect.any(Function) })
    )
    expect(vm.items).toEqual([{ bar: 'bar' }])
  })
})
